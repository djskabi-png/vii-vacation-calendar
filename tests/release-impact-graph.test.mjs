import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { buildImpact, loadImpactGraph, resolveImpact, validateImpactGraph, registeredCheckIds } from '../scripts/release-impact-graph.mjs';

const graph = loadImpactGraph();

test('production graph is valid and expands actual generated registry checks', () => {
  assert.deepEqual(validateImpactGraph(graph), []);
  const ids = registeredCheckIds();
  assert.equal(ids.size, 69);
  for(const id of ['discovery.vacation.tomorrow.ready','discovery.vacation.friday-weekend.ready','discovery.events.lastminute.ready','discovery.events.friday.ready'])assert.ok(ids.has(id));
  assert.ok(ids.has('locale.ru.place.semantic'));
  assert.ok(ids.has('seo.sitemap.search-pages'));
});

test('shared map change reaches transitive consumers without publishing unchanged edge services', () => {
  const result = buildImpact(graph, ['app/components/map/leaflet-places-map.tsx']);
  assert.equal(result.status, 'mapped');
  assert.deepEqual(result.buildUnits, ['managed-site']);
  for (const id of ['vacations','events','spa','hourly','activities','trails','booking']) assert.ok(result.consumers.includes(id), id);
  assert.ok(result.requiredChecks.includes('map.snapshot.spa'));
  assert.ok(result.requiredChecks.includes('api.starting-prices'));
  assert.ok(result.requiredLocalTests.includes('tests/map-canvas-ownership.test.mjs'));
  assert.equal(result.rollbackIdentity, null);
  assert.equal(result.releaseReady, false);
});

test('changed service deploys only itself while downstream verification expands', () => {
  const result = buildImpact(graph, ['services/vii-edge-delivery/src/index.ts']);
  assert.deepEqual(result.buildUnits, ['edge-delivery']);
  const merged = buildImpact(graph, ['services/vii-edge-delivery/src/index.ts','app/components/map-provider-boundary.tsx']);
  assert.deepEqual(merged.buildUnits, ['edge-delivery','managed-site']);
});

test('path boundaries reject unknown, traversal, absolute and lookalike artifacts', () => {
  for (const path of ['app/new-unregistered-box.tsx','../app/components/map/x.ts','C:/app/x.ts','app/components/map-provider-boundary.tsx.backup','app/components/map-provider-boundary.tsx.extra']) {
    assert.equal(resolveImpact(graph,path).status, 'blocked', path);
  }
  assert.equal(resolveImpact(graph,'app\\components\\map\\leaflet-places-map.tsx').ownerBox, 'maps');
  const ambiguous = structuredClone(graph);
  ambiguous.entries.push({id:'ambiguous',ownerBox:'search',match:['app/components/map/']});
  assert.equal(resolveImpact(ambiguous,'app/components/map/x.tsx').reason,'ambiguous_owner');
});

test('validation rejects missing checks, dependencies, build units and cycles', () => {
  const dangling = structuredClone(graph);
  dangling.nodes.maps.requiredChecks.push('fake.check');
  dangling.nodes.maps.dependsOn.push('missing');
  dangling.nodes.maps.buildUnits.push('unprovisioned-worker');
  const errors = validateImpactGraph(dangling);
  assert.ok(errors.some(error=>error.startsWith('dangling_check:')));
  assert.ok(errors.some(error=>error.startsWith('dangling_dependency:')));
  assert.ok(errors.some(error=>error.startsWith('unknown_build_unit:')));
  const cyclic=structuredClone(graph); cyclic.nodes.maps.dependsOn.push('vacations');
  assert.equal(buildImpact(cyclic,['app/components/map/x.tsx']).reason,'invalid_graph');
});

test('all actual cumulative candidate paths have explicit ownership', () => {
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
  const files=[...git('diff','--name-only',graph.baselineSource,'HEAD','--'),...git('diff','--name-only','HEAD','--'),...git('ls-files','--others','--exclude-standard')];
  const impact=buildImpact(graph,files);
  assert.equal(impact.status,'mapped',JSON.stringify(impact.files.filter(file=>file.status==='blocked')));
});

test('real CLI works on this OS and a missing rollback cannot approve a release', () => {
  const script='scripts/release-impact-graph.mjs';
  const mapped=spawnSync(process.execPath,[script,'app/components/map/leaflet-places-map.tsx'],{encoding:'utf8'});
  assert.equal(mapped.status,0,mapped.stderr);
  assert.equal(JSON.parse(mapped.stdout).status,'mapped');
  const unknown=spawnSync(process.execPath,[script,'app/unowned.ts'],{encoding:'utf8'});
  assert.equal(unknown.status,1);
  const release=spawnSync(process.execPath,[script,'--release','app/components/map/leaflet-places-map.tsx'],{encoding:'utf8'});
  assert.equal(release.status,1);
  assert.ok(JSON.parse(release.stdout).releaseBlockers.includes('verified_rollback_identity_required'));
});
