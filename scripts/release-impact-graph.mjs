import { existsSync, readFileSync } from 'node:fs';
import { resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export function loadImpactGraph(root = process.cwd()) {
  return JSON.parse(readFileSync(resolve(root, 'project_knowledge/release_controls/vii-release-impact-graph.json'), 'utf8'));
}

// Expand the trusted production initializer, including generated locale and
// sitemap checks. A matching string elsewhere in the file is not a check.
export function registeredCheckIds(root = process.cwd()) {
  const source = readFileSync(resolve(root, 'app/lib/quality-platform.ts'), 'utf8');
  const ast = ts.createSourceFile('registry.ts', source, ts.ScriptTarget.Latest, true);
  let initializer;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'qualityRegistry') initializer = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (!initializer) throw new Error('quality_registry_missing');
  const code = ts.transpileModule(`const html = input => input; const json = input => input; return (${initializer});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Set(new Function(code)().map(check => check.checkId));
}

function normalize(value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) throw new Error('invalid_impact_path');
  const path = posix.normalize(value.replaceAll('\\', '/')).replace(/^\.\//, '');
  if (path === '.' || path.startsWith('../') || path.startsWith('/') || /^[a-z]:/i.test(path) || path.split('/').includes('.git')) throw new Error('invalid_impact_path');
  return path;
}

function matches(path, pattern) {
  return pattern.endsWith('/') ? path.startsWith(pattern) : path === pattern;
}

export function validateImpactGraph(graph, root = process.cwd()) {
  const errors = [], nodes = graph.nodes || {}, ids = new Set(Object.keys(nodes));
  const checks = registeredCheckIds(root), entries = new Set();
  for (const [id, unit] of Object.entries(graph.buildUnits || {})) {
    if (!unit.source || !existsSync(resolve(root, unit.source))) errors.push(`build_unit_source_missing:${id}`);
  }
  for (const entry of graph.entries || []) {
    if (!entry.id || entries.has(entry.id) || !entry.match?.length || !ids.has(entry.ownerBox)) errors.push(`invalid_entry:${entry.id}`);
    entries.add(entry.id);
    for (const pattern of entry.match || []) {
      try { normalize(pattern); } catch { errors.push(`invalid_pattern:${entry.id}`); }
    }
  }
  const visiting = new Set(), visited = new Set();
  const visit = id => {
    if (visiting.has(id)) { errors.push(`cycle:${id}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    const node = nodes[id];
    if (!node || !Array.isArray(node.dependsOn) || !Array.isArray(node.requiredChecks) || !Array.isArray(node.buildUnits)) { errors.push(`invalid_node:${id}`); visiting.delete(id); return; }
    for (const dependency of node.dependsOn) {
      if (!ids.has(dependency)) errors.push(`dangling_dependency:${id}:${dependency}`);
      else visit(dependency);
    }
    for (const check of node.requiredChecks) if (!checks.has(check)) errors.push(`dangling_check:${id}:${check}`);
    for (const unit of node.buildUnits) if (!graph.buildUnits?.[unit]) errors.push(`unknown_build_unit:${id}:${unit}`);
    for (const path of node.requiredLocalTests || []) if (!existsSync(resolve(root, path))) errors.push(`local_test_missing:${id}:${path}`);
    visiting.delete(id); visited.add(id);
  };
  for (const id of ids) visit(id);
  return errors;
}

export function resolveImpact(graph, file) {
  let path;
  try { path = normalize(file); } catch { return { file, status: 'blocked', reason: 'invalid_path' }; }
  if (/\.(?:backup|bak|orig|rej)$/i.test(path)) return { file: path, status: 'blocked', reason: 'non_source_artifact' };
  const candidates = graph.entries.flatMap(entry => entry.match.filter(pattern => matches(path, pattern)).map(pattern => ({ entry, specificity: pattern.length })));
  candidates.sort((a, b) => b.specificity - a.specificity);
  if (!candidates.length) return { file: path, status: 'blocked', reason: 'unknown_owner' };
  const best = candidates.filter(candidate => candidate.specificity === candidates[0].specificity);
  if (new Set(best.map(candidate => candidate.entry.ownerBox)).size > 1) return { file: path, status: 'blocked', reason: 'ambiguous_owner' };
  return { file: path, status: 'mapped', ownerBox: best[0].entry.ownerBox };
}

export function buildImpact(graph, files, options = {}) {
  const errors = validateImpactGraph(graph, options.root);
  if (errors.length) return { status: 'blocked', reason: 'invalid_graph', errors, files: [] };
  const resolutions = [...new Set(files)].map(file => resolveImpact(graph, file));
  const owners = new Set(resolutions.filter(entry => entry.status === 'mapped').map(entry => entry.ownerBox));
  const affected = new Set(owners);
  // Reverse closure expands verification to every transitive consumer.
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const [id, node] of Object.entries(graph.nodes)) {
      if (!affected.has(id) && node.dependsOn.some(dependency => affected.has(dependency))) { affected.add(id); expanded = true; }
    }
  }
  const checkIds = new Set(), units = new Set(), localTests = new Set();
  for (const id of affected) {
    for (const check of graph.nodes[id].requiredChecks) checkIds.add(check);
    for (const path of graph.nodes[id].requiredLocalTests || []) localTests.add(path);
  }
  // Only changed owners require deployment. Unchanged consumer services need
  // verification, not an unnecessary publication.
  for (const id of owners) for (const unit of graph.nodes[id].buildUnits) units.add(unit);
  const rollback = options.rollback || null;
  // These fields describe a proposed rollback. Their presence is deliberately
  // not described as observed deployment verification by this source tool.
  const rollbackComplete = Boolean(rollback && /^[a-f0-9]{40}$/.test(rollback.source || '') && /^[a-f0-9]{40}$/.test(rollback.tree || '') && rollback.deployment && rollback.environmentRevision != null && rollback.evidencePath);
  return { schemaVersion: graph.schemaVersion, graphId: graph.graphId,
    status: resolutions.some(entry => entry.status !== 'mapped') ? 'blocked' : 'mapped',
    files: resolutions, owners: [...owners].sort(), consumers: [...affected].filter(id => !owners.has(id)).sort(),
    requiredChecks: [...checkIds].sort(), requiredLocalTests: [...localTests].sort(), buildUnits: [...units].sort(),
    rollbackIdentity: rollbackComplete ? rollback : null,
    rollbackEvidenceVerified: false,
    releaseReady: false,
    releaseBlockers: ['observed_release_and_rollback_verification_required', ...(rollbackComplete ? [] : ['verified_rollback_identity_required'])],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2), release = args.includes('--release');
  const rollbackIndex = args.indexOf('--rollback');
  const rollback = rollbackIndex >= 0 ? JSON.parse(readFileSync(resolve(args[rollbackIndex + 1]), 'utf8')) : undefined;
  const files = args.filter((arg, index) => !arg.startsWith('--') && !(rollbackIndex >= 0 && index === rollbackIndex + 1));
  const result = buildImpact(loadImpactGraph(), files, { rollback });
  console.log(JSON.stringify(result, null, 2));
  // This source-only tool cannot approve a public release by itself.
  if (!files.length || result.status === 'blocked' || release) process.exitCode = 1;
}
