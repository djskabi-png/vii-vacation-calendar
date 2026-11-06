import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditUnitCandidate, auditFrozenUnitArtifact } from './release-unit-candidate.mjs';
import { buildImpact } from '../scripts/release-impact-graph.mjs';
import { releaseBuildIdentity } from '../scripts/release-build-identity.mjs';
import { validateReleaseCandidate } from '../scripts/release-candidate-manifest.mjs';

const GRAPH = 'project_knowledge/release_controls/vii-release-impact-graph.json';
const POLICY = 'project_knowledge/release_controls/vii-release-acceptance-policy.json';
const SHA = /^[a-f0-9]{40}$/, DIGEST = /^[a-f0-9]{64}$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hashObject = value => digest(JSON.stringify(value));
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 }).trim();
const committed = (root, source, path) => JSON.parse(git(root, ['show', `${source}:${path}`]));
const fresh = (value, now, maxAge) => { const age = now - Date.parse(value); return Number.isFinite(age) && age >= 0 && age <= maxAge; };
function reader(root) {
  const absoluteRoot = realpathSync(root);
  const bytes = (path, maxBytes = 4 * 1024 * 1024) => {
    if (typeof path !== 'string' || !path) throw Error('evidence_path_missing');
    const absolute = realpathSync(resolve(root, path)), rel = relative(absoluteRoot, absolute), info = statSync(absolute);
    if (!rel || rel.startsWith('..') || isAbsolute(rel) || !info.isFile() || info.size > maxBytes) throw Error('evidence_path_or_size_invalid');
    return readFileSync(absolute);
  };
  return { bytes, json: path => JSON.parse(bytes(path).toString('utf8').replace(/^\uFEFF/, '')) };
}
const sameSet = (a, b) => Array.isArray(a) && new Set(a).size === a.length && JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
function boundedPaths(value) {
  if (!Array.isArray(value) || value.length > 256 || new Set(value).size !== value.length || value.some(path => typeof path !== 'string' || path.length > 1024)) throw Error('evidence_paths_invalid');
  return value;
}

/** Evidence admission, never deployment authority. Local receipt integrity is
 * not proof of execution provenance. A private durable QQQAAA readback remains
 * required before a publisher may treat these observations as a release seal. */
export async function auditReleaseCandidate(manifest, { root = process.cwd(), now = Date.now() } = {}) {
  root = resolve(root);
  if (manifest?.schemaVersion === 1) return { ...validateReleaseCandidate(manifest, { root, now }), publicationApproved: false, publicReleaseVerified: false, verificationOnly: true };
  const failures = [], fail = message => failures.push(message), read = reader(root);
  let source, tree, impact, artifacts = [], artifactSetSha256, environmentSetSha256;
  try {
    if (manifest?.schemaVersion !== 2 || !['candidate', 'published'].includes(manifest.stage)) throw Error('schema2_stage_required');
    const preflight = await auditUnitCandidate(manifest, { root, now });
    if (preflight.status !== 'passed') throw Error(`unit_preflight_failed:${preflight.failures.join(',')}`);
    source = preflight.source; tree = preflight.tree;
    const graph = committed(root, source, GRAPH), policy = committed(root, source, POLICY);
    if (policy.schemaVersion !== 1 || manifest.policyId !== policy.policyId || !Array.isArray(policy.interfaces) || !Array.isArray(policy.browserFamilies) || !Array.isArray(policy.browserFixtureAllowedFamilies)) throw Error('acceptance_policy_invalid');
    const actualFiles = git(root, ['diff', '--name-only', graph.baselineSource, source, '--']).split(/\r?\n/).filter(Boolean);
    impact = buildImpact(graph, actualFiles, { root });
    if (impact.status !== 'mapped' || !sameSet(manifest.changedFiles, actualFiles)) throw Error('changed_files_mismatch');
    if (manifest.candidate.buildIdentity !== releaseBuildIdentity({ cwd: root })) throw Error('candidate_build_identity_mismatch');
    const integrity = read.json(manifest.sourceEvidencePath);
    if (integrity.verificationScope !== 'source-integrity-only' || integrity.status !== 'passed' || integrity.clean !== true || integrity.head !== source || integrity.tree !== tree) throw Error('source_integrity_not_verified');
    if (!preflight.requiredUnits.length) {
      // Verification tools and policies still require their own affected
      // tests. Having no deployable unit is not permission to skip those.
      if (manifest.stage !== 'candidate' || manifest.publicDeployments != null || manifest.retainedArtifacts?.length || manifest.configurationEvidencePaths?.length) throw Error('source_only_cannot_claim_runtime_change');
      const checks = new Set();
      for (const path of boundedPaths(manifest.evidencePaths)) {
        const r = read.json(path);
        if (r.schemaVersion !== 2 || r.engine !== 'local-test' || r.status !== 'passed' || r.exitCode !== 0 || r.failedCount !== 0 || r.blockedCount !== 0 || r.cancelledCount !== 0 || r.source !== source || r.tree !== tree || !fresh(r.observedAt, now, 86400000) || !Array.isArray(r.executedCheckIds) || !DIGEST.test(r.evidenceSha256 ?? '') || digest(read.bytes(r.evidencePath)) !== r.evidenceSha256) throw Error('source_only_test_receipt_invalid');
        for (const id of r.executedCheckIds) checks.add(id);
      }
      for (const id of impact.requiredLocalTests) if (!checks.has(id)) fail(`required_local_test_missing:${id}`);
      if (impact.requiredChecks.length) fail('source_only_runtime_checks_unavailable');
      return { verificationScope: 'source-only-no-publication', status: failures.length ? 'blocked' : 'passed', source, tree, verificationOnly: true, publicationApproved: false, publicReleaseVerified: false, failures };
    }

    const affected = new Set([...impact.owners, ...impact.consumers]);
    const verificationUnits = new Set([...affected].flatMap(id => graph.nodes[id].buildUnits));
    // Configuration dependencies also need current verification, without
    // requiring an unchanged service's artifact to be rebuilt or republished.
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const item of policy.interfaces) {
        if (!Array.isArray(item.units) || !item.units.length || item.units.some(unit => !graph.buildUnits[unit])) throw Error('interface_policy_invalid');
        if (item.units.some(unit => verificationUnits.has(unit))) for (const unit of item.units) if (!verificationUnits.has(unit)) { verificationUnits.add(unit); expanded = true; }
      }
    }
    const retained = manifest.retainedArtifacts ?? [];
    if (!Array.isArray(retained) || retained.some(entry => preflight.requiredUnits.includes(entry?.unit)) || !sameSet([...preflight.requiredUnits, ...retained.map(entry => entry?.unit)], [...verificationUnits])) throw Error('verification_artifact_coverage_mismatch');
    artifacts = [...preflight.units];
    for (const entry of retained) artifacts.push(await auditFrozenUnitArtifact(entry, { root, source, now }));
    artifacts.sort((a, b) => a.unit.localeCompare(b.unit));
    const entries = [...manifest.unitArtifacts, ...retained];
    for (const entry of entries) {
      const audit = read.json(entry.auditReceiptPath);
      if (!policy.unitAuditDefinitions?.[entry.unit] || audit.definitionVersion !== policy.unitAuditDefinitions[entry.unit]) fail(`artifact_audit_definition_mismatch:${entry.unit}`);
      if (entry.unit === 'managed-site' && !audit.executedCheckIds?.includes('artifact.tested-payload-parity')) fail('tested_site_payload_parity_missing');
    }
    artifactSetSha256 = hashObject(artifacts.map(({ unit, artifactSource, artifactTree, artifactSha256, artifactBytes, inputFingerprint }) => ({ unit, artifactSource, artifactTree, artifactSha256, artifactBytes, inputFingerprint })));
    if (manifest.artifactSetSha256 !== artifactSetSha256) fail('artifact_set_mismatch');

    const configurations = boundedPaths(manifest.configurationEvidencePaths).map(path => read.json(path));
    if (!sameSet(configurations.map(item => item.unit), [...verificationUnits])) throw Error('configuration_coverage_mismatch');
    const intactEvidence = item => DIGEST.test(item.evidenceSha256 ?? '') && digest(read.bytes(item.evidencePath)) === item.evidenceSha256;
    for (const item of configurations) {
      if (item.schemaVersion !== 1 || item.engine !== 'environment-readback' || item.status !== 'passed' || !fresh(item.observedAt, now, 3600000) || !DIGEST.test(item.configurationSha256 ?? '') || !DIGEST.test(item.previousConfigurationSha256 ?? '') || !['string','number'].includes(typeof item.environmentRevision) || String(item.environmentRevision).length === 0 || item.bindingsVerified !== true || !intactEvidence(item)) fail(`configuration_not_verified:${item.unit}`);
      if (['managed-site','edge-delivery','quality-controller','quality-browser'].includes(item.unit) && item.targetBuildIdentity !== manifest.candidate.buildIdentity) fail(`target_build_mismatch:${item.unit}`);
      const ownArtifact = artifacts.find(proof => proof.unit === item.unit);
      const applicationArtifact = artifacts.find(proof => proof.unit === 'managed-site');
      if (item.artifactSource !== ownArtifact?.artifactSource) fail(`configuration_artifact_source_mismatch:${item.unit}`);
      if (applicationArtifact && ['managed-site','edge-delivery','quality-controller','quality-browser'].includes(item.unit) && item.targetApplicationSource !== applicationArtifact.artifactSource) fail(`configuration_application_source_mismatch:${item.unit}`);
      const browserArtifact = artifacts.find(proof => proof.unit === 'quality-browser');
      if (item.unit === 'quality-controller' && browserArtifact && item.browserRunnerSource !== browserArtifact.artifactSource) fail('configuration_browser_source_mismatch');
    }
    configurations.sort((a, b) => a.unit.localeCompare(b.unit));
    environmentSetSha256 = hashObject(configurations.map(({ unit, configurationSha256, environmentRevision, targetBuildIdentity, artifactSource, targetApplicationSource, browserRunnerSource }) => ({ unit, configurationSha256, environmentRevision, targetBuildIdentity: targetBuildIdentity ?? null, artifactSource, targetApplicationSource: targetApplicationSource ?? null, browserRunnerSource: browserRunnerSource ?? null })));
    if (manifest.candidate.environmentRevision !== environmentSetSha256) fail('environment_set_mismatch');

    function accepted(receipt, maxAge = 86400000, runtime = true) {
      if (receipt?.schemaVersion !== 2 || receipt.status !== 'passed' || receipt.source !== source || receipt.tree !== tree || receipt.buildIdentity !== manifest.candidate.buildIdentity || receipt.artifactSetSha256 !== artifactSetSha256 || runtime && receipt.environmentSetSha256 !== environmentSetSha256 || !fresh(receipt.observedAt, now, maxAge) || receipt.failedCount !== 0 || receipt.blockedCount !== 0 || receipt.cancelledCount !== 0 || receipt.exitCode != null && receipt.exitCode !== 0 || !Array.isArray(receipt.executedCheckIds)) return false;
      if (!DIGEST.test(receipt.evidenceSha256 ?? '') || digest(read.bytes(receipt.evidencePath)) !== receipt.evidenceSha256) return false;
      return true;
    }
    const evidence = [];
    for (const path of boundedPaths(manifest.evidencePaths)) {
      try {
        const receipt = read.json(path);
        if (!accepted(receipt, 86400000, receipt.engine !== 'local-test')) throw Error('invalid');
        if (receipt.engine === 'local-test' && receipt.exitCode !== 0) throw Error('invalid');
        if (receipt.engine === 'http' && receipt.fixtureOnly !== false) throw Error('invalid');
        if (receipt.engine === 'browser' && receipt.fixtureOnly !== false && !policy.browserFixtureAllowedFamilies.includes(receipt.family)) throw Error('invalid');
        evidence.push(receipt);
      } catch { fail(`candidate_receipt_invalid:${path}`); }
    }
    for (const id of impact.requiredLocalTests) if (!evidence.some(item => item.engine === 'local-test' && item.executedCheckIds.includes(id))) fail(`required_local_test_missing:${id}`);
    for (const id of impact.requiredChecks) if (!evidence.some(item => item.engine === 'http' && item.executedCheckIds.includes(id))) fail(`required_http_check_missing:${id}`);
    for (const family of [...affected].filter(id => policy.browserFamilies.includes(id))) for (const viewport of ['desktop','mobile']) if (!evidence.some(item => item.engine === 'browser' && item.family === family && item.viewport === viewport && item.executedCheckIds.length > 0)) fail(`browser_evidence_missing:${family}:${viewport}`);
    for (const item of policy.interfaces.filter(item => item.units.some(unit => verificationUnits.has(unit)))) if (!evidence.some(receipt => receipt.engine === 'integration' && receipt.interfaceId === item.id && receipt.definitionVersion === item.definitionVersion && receipt.fixtureOnly === false && receipt.executedCheckIds.length > 0)) fail(`interface_not_verified:${item.id}`);

    const rollback = boundedPaths(manifest.rollbackEvidencePaths).map(path => read.json(path));
    const rollbackUnits = new Set([...preflight.requiredUnits, ...configurations.filter(item => item.configurationSha256 !== item.previousConfigurationSha256).map(item => item.unit)]);
    if (!sameSet(rollback.map(item => item.unit), [...rollbackUnits])) fail('rollback_coverage_mismatch');
    for (const item of rollback) if (item.schemaVersion !== 1 || item.engine !== 'rollback-readback' || item.status !== 'passed' || !fresh(item.observedAt, now, 7 * 86400000) || !SHA.test(item.source ?? '') || !SHA.test(item.tree ?? '') || git(root, ['rev-parse', `${item.source}^{tree}`]) !== item.tree || !DIGEST.test(item.artifactSha256 ?? '') || typeof item.deployment !== 'string' || !item.deployment || item.environmentRevision == null || typeof item.procedureVersion !== 'string' || !item.procedureVersion || !intactEvidence(item)) fail(`rollback_not_verified:${item.unit}`);
    const independent = read.json(manifest.independentEvidencePath);
    if (!accepted(independent) || independent.engine !== 'independent-review' || typeof independent.checker !== 'string' || !independent.checker || typeof independent.operator !== 'string' || !independent.operator || independent.checker === independent.operator) fail('independent_acceptance_missing');

    if (manifest.stage === 'candidate' && manifest.publicDeployments != null) fail('candidate_cannot_claim_public_deployment');
    if (manifest.stage === 'published') {
      const deployments = manifest.publicDeployments;
      if (!Array.isArray(deployments) || !sameSet(deployments.map(item => item.unit), [...rollbackUnits])) throw Error('public_deployment_coverage_mismatch');
      const publicEvidence = boundedPaths(manifest.publicEvidencePaths).map(path => read.json(path));
      for (const deployment of deployments) {
        const artifact = artifacts.find(item => item.unit === deployment.unit);
        if (typeof deployment.deployment !== 'string' || !deployment.deployment || !['string','number'].includes(typeof deployment.environmentRevision) || typeof deployment.origin !== 'string' || new URL(deployment.origin).origin !== deployment.origin || !deployment.origin.startsWith('https://')) throw Error('public_deployment_identity_invalid');
        if (!publicEvidence.some(item => accepted(item, 3600000) && item.engine === 'public-smoke' && item.fixtureOnly === false && item.unit === deployment.unit && item.deployment === deployment.deployment && item.environmentRevision === deployment.environmentRevision && item.origin === deployment.origin && item.deployedArtifactSha256 === artifact?.artifactSha256 && item.deployedSource === artifact?.artifactSource && item.executedCheckIds.length > 0)) fail(`public_deployment_not_verified:${deployment.unit}`);
      }
    }
  } catch (error) { fail(error instanceof Error ? error.message : 'candidate_validation_failed'); }
  const passed = failures.length === 0;
  return { verificationScope: manifest?.stage === 'published' ? 'unit-aware-post-publication-evidence-admission' : 'unit-aware-pre-publication-evidence-admission', status: passed ? 'passed' : 'blocked', source, tree, artifactSetSha256, environmentSetSha256, units: artifacts, failures, verificationOnly: true, privateAuthorityRequired: true, publicationApproved: false, publicReleaseVerified: false };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let result;
  try { result = await auditReleaseCandidate(JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8').replace(/^\uFEFF/, ''))); }
  catch { result = { status: 'blocked', publicationApproved: false, publicReleaseVerified: false, failures: ['manifest_unavailable_or_invalid'] }; }
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'passed') process.exitCode = 1;
}
