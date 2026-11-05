import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildImpact, loadImpactGraph } from './release-impact-graph.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const validSource = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

export function validateReleaseCandidate(manifest, options = {}) {
  const root = resolve(options.root || process.cwd()), now = options.now ?? Date.now();
  const failures = [];
  const fail = message => failures.push(message);
  const read = path => {
    if (typeof path !== 'string' || !path) throw Error('evidence_path_missing');
    const absolute=resolve(root,path), rel=relative(root,absolute);
    if (rel.startsWith('..') || isAbsolute(rel)) throw Error('evidence_outside_workspace');
    return readFileSync(absolute);
  };
  const readJson = path => JSON.parse(read(path).toString('utf8'));
  const currentTree = options.treeForSource || (source => execFileSync('git',['rev-parse',`${source}^{tree}`],{cwd:root,encoding:'utf8'}).trim());
  const candidate = manifest?.candidate || {};
  try {
    const state=options.workingState || {
      source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
      dirty:Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()),
    };
    if(state.dirty || state.source!==candidate.source)fail('candidate_worktree_not_frozen');
  } catch { fail('candidate_worktree_unavailable'); }
  if (manifest?.schemaVersion !== 1 || !['candidate','published'].includes(manifest?.stage)) fail('invalid_manifest');
  if (!validSource(candidate.source) || !validSource(candidate.tree)) fail('candidate_identity_missing');
  else {
    try { if (currentTree(candidate.source)!==candidate.tree) fail('candidate_tree_mismatch'); }
    catch { fail('candidate_source_unavailable'); }
  }
  const artifact = candidate.artifact || {};
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256 || '')) fail('artifact_digest_missing');
  try { if (sha(read(artifact.path)) !== artifact.sha256) fail('artifact_digest_mismatch'); }
  catch { fail('artifact_unavailable'); }
  let sourceGate;
  try {
    sourceGate=readJson(manifest.sourceEvidencePath);
    if (sourceGate.verificationScope!=='source-integrity-only' || sourceGate.status!=='passed' || sourceGate.clean!==true || sourceGate.head!==candidate.source || sourceGate.tree!==candidate.tree) fail('source_integrity_not_verified');
  } catch { fail('source_evidence_unavailable'); }
  let impact;
  try {
    const graph=options.graph || loadImpactGraph(root);
    const files=options.changedFiles || execFileSync('git',['diff','--name-only',manifest.impactBase || graph.baselineSource,candidate.source,'--'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
    impact=buildImpact(graph,files,{root:options.registryRoot || root});
    if(impact.status!=='mapped')fail('impact_unmapped');
    for(const unit of impact.buildUnits || []) if(graph.buildUnits?.[unit]?.provisioningRequired)fail(`build_unit_unprovisioned:${unit}`);
    if(manifest.graphId!==graph.graphId)fail('impact_graph_mismatch');
    if(JSON.stringify([...new Set(manifest.changedFiles || [])].sort())!==JSON.stringify([...new Set(files)].sort()))fail('changed_files_mismatch');
  } catch { fail('impact_unavailable'); }
  const evidence=[];
  for(const path of manifest.evidencePaths || []) {
    try {
      const receipt=readJson(path);
      const age=now-Date.parse(receipt.observedAt);
      const exitRequired=['build','local-test'].includes(receipt.engine);
      if(receipt.status!=='passed' || exitRequired && receipt.exitCode!==0 || receipt.exitCode!=null && receipt.exitCode!==0 || receipt.failedCount>0 || receipt.blockedCount>0 || receipt.source!==candidate.source || receipt.tree!==candidate.tree || receipt.artifactSha256!==artifact.sha256 || !Number.isFinite(age) || age<0 || age>24*60*60*1000)fail(`invalid_candidate_receipt:${path}`);
      else evidence.push(receipt);
    } catch { fail(`evidence_unavailable:${path}`); }
  }
  if(!evidence.some(receipt=>receipt.engine==='build'))fail('build_not_verified');
  for(const id of ['artifact.fixture-exclusion','artifact.import-integrity']) if(!evidence.some(receipt=>receipt.engine==='artifact-audit' && receipt.executedCheckIds?.includes(id)))fail(`artifact_audit_missing:${id}`);
  for(const id of impact?.requiredChecks || []) if(!evidence.some(receipt=>receipt.engine==='http' && receipt.executedCheckIds?.includes(id)))fail(`required_check_missing:${id}`);
  for(const id of impact?.requiredLocalTests || []) if(!evidence.some(receipt=>receipt.engine==='local-test' && receipt.executedCheckIds?.includes(id)))fail(`required_local_test_missing:${id}`);
  // Browser interaction is independent of HTTP semantics. Each affected public
  // family must have its own observed desktop and mobile receipt.
  const browserFamilies=(impact?.consumers || []).concat(impact?.owners || []).filter(id=>['vacations','events','spa','hourly','activities','trails','providers','global-shell','search','home-sliders','admin','maps'].includes(id));
  for(const family of new Set(browserFamilies)) for(const viewport of ['desktop','mobile']) {
    if(!evidence.some(receipt=>receipt.engine==='browser' && receipt.family===family && receipt.viewport===viewport && receipt.environmentRevision===candidate.environmentRevision))fail(`browser_evidence_missing:${family}:${viewport}`);
  }
  if(candidate.environmentRevision==null)fail('candidate_environment_missing');
  try {
    const rollback=readJson(manifest.rollbackEvidencePath);
    const age=now-Date.parse(rollback.observedAt);
    if(rollback.status!=='passed' || !validSource(rollback.source) || !validSource(rollback.tree) || !rollback.deployment || rollback.environmentRevision==null || !/^[a-f0-9]{64}$/.test(rollback.artifactSha256 || '') || !rollback.procedureVersion || !Number.isFinite(age) || age<0 || age>7*24*60*60*1000)fail('rollback_not_verified');
  } catch { fail('rollback_evidence_unavailable'); }
  if(manifest.stage==='candidate' && manifest.publicDeployment)fail('candidate_cannot_claim_public_deployment');
  if(manifest.stage==='published') {
    try {
      const observed=readJson(manifest.publicEvidencePath), deployment=manifest.publicDeployment;
      const age=now-Date.parse(observed.observedAt);
      if(!deployment?.deployment || observed.status!=='passed' || observed.engine!=='public-smoke' || observed.deployment!==deployment.deployment || observed.source!==candidate.source || observed.tree!==candidate.tree || observed.artifactSha256!==artifact.sha256 || observed.environmentRevision!==deployment.environmentRevision || observed.origin!==deployment.origin || !Number.isFinite(age) || age<0 || age>60*60*1000)fail('public_deployment_not_verified');
    } catch { fail('public_evidence_unavailable'); }
  }
  return {verificationScope:manifest?.stage==='published'?'post-publication':'candidate-before-publication',status:failures.length?'blocked':'passed',candidateSource:candidate.source,artifactSha256:artifact.sha256,failures,publicationApproved:manifest?.stage==='candidate' && failures.length===0,publicReleaseVerified:manifest?.stage==='published' && failures.length===0};
}

if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  let report;
  try { report=validateReleaseCandidate(JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'))); }
  catch { report={status:'blocked',publicationApproved:false,failures:['manifest_unavailable_or_invalid']}; }
  console.log(JSON.stringify(report,null,2));
  if(report.status!=='passed')process.exitCode=1;
}
