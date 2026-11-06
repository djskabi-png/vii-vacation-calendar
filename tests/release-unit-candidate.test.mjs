import test from 'node:test';
import assert from 'node:assert/strict';
import {auditUnitCandidate} from '../tools/release-unit-candidate.mjs';
import {fixture} from './fixtures/release-unit-fixture.mjs';

test('real frozen descendant reuses both exact artifacts but never grants publication approval',async()=>{
 const f=fixture();try{const r=await f.run();assert.equal(r.status,'passed',JSON.stringify(r.failures));assert.equal(r.units.length,2);assert.ok(r.units.every(x=>x.reused&&x.artifactSource===f.base));assert.equal(r.publicationApproved,false);assert.equal(r.publicReleaseVerified,false);}finally{f.cleanup();}
});
test('old immutable builds require fresh independent artifact audits, not redated build claims',async()=>{
 const f=fixture();try{
  for(const entry of f.manifest.unitArtifacts){const receipt=f.json(entry.buildReceiptPath);receipt.observedAt='2020-01-01T00:00:00Z';f.write(entry.buildReceiptPath,receipt);}
  assert.equal((await f.run()).status,'passed');
  const entry=f.manifest.unitArtifacts[0],audit=f.json(entry.auditReceiptPath);audit.observedAt=new Date(f.now-86400001).toISOString();f.write(entry.auditReceiptPath,audit);
  assert.ok((await f.run()).failures.includes('managed-site:artifact_audit_invalid'));
  assert.equal(f.json(entry.buildReceiptPath).observedAt,'2020-01-01T00:00:00Z');
 }finally{f.cleanup();}
});
test('coverage is derived from committed impact graph, not caller required-unit claims',async()=>{
 const f=fixture();try{
  for(const units of [[],[f.manifest.unitArtifacts[0]],[...f.manifest.unitArtifacts,f.manifest.unitArtifacts[0]],[...f.manifest.unitArtifacts,{unit:'untrusted'}]]){
   const r=await auditUnitCandidate({...f.manifest,unitArtifacts:units,requiredUnits:[]},{root:f.root,now:f.now});assert.ok(r.failures.includes('unit_coverage_mismatch'));
  }
  assert.ok((await auditUnitCandidate({...f.manifest,schemaVersion:1},{root:f.root,now:f.now})).failures.includes('schema2_required'));
  assert.ok((await auditUnitCandidate({...f.manifest,impactBase:f.source,unitArtifacts:[]},{root:f.root,now:f.now})).failures.includes('impact_base_invalid'));
 }finally{f.cleanup();}
});
test('actual dirty tree, changed transitive dependency and nonancestor reject receipt reuse',async()=>{
 const f=fixture();try{
  f.write('shared/value.ts','export const value=2;');assert.ok((await f.run()).failures.includes('candidate_worktree_not_frozen'));
  const changed=f.commit();f.manifest.candidate={source:changed,tree:f.git(['rev-parse','HEAD^{tree}'])};
  assert.ok((await f.run()).failures.some(x=>x==='quality-controller:artifact_input_fingerprint_mismatch'));
  f.git(['checkout','-q','--orphan','unrelated']);f.git(['add','.']);f.git(['commit','-qm','synthetic unrelated']);
  f.manifest.candidate={source:f.git(['rev-parse','HEAD']),tree:f.git(['rev-parse','HEAD^{tree}'])};
  const unrelatedBase=f.manifest.candidate.source;
  // Keep an actual impact diff in the new unrelated line of history.
  const graph=f.json('project_knowledge/release_controls/vii-release-impact-graph.json');graph.baselineSource=unrelatedBase;f.write('project_knowledge/release_controls/vii-release-impact-graph.json',graph);
  f.manifest.impactBase=unrelatedBase;f.write('project_knowledge/note.txt','new unrelated documentation');f.manifest.candidate.source=f.commit();f.manifest.candidate.tree=f.git(['rev-parse','HEAD^{tree}']);
  assert.ok((await f.run()).failures.some(x=>x.includes('artifact_source_not_ancestor')));
 }finally{f.cleanup();}
});
test('actual artifact tampering, wrong sizes and unaudited/stale provenance fail closed',async()=>{
 const f=fixture();try{
  const entry=f.manifest.unitArtifacts[0],original=f.json(entry.auditReceiptPath);
  for(const mutate of [x=>{x.source='0'.repeat(40)},x=>{x.artifactSha256='0'.repeat(64)},x=>{x.failedCount=1},x=>{x.observedAt=new Date(f.now-86400001).toISOString()},x=>{x.executedCheckIds=[]}]){
   const audit=structuredClone(original);mutate(audit);f.write(entry.auditReceiptPath,audit);assert.ok((await f.run()).failures.includes('managed-site:artifact_audit_invalid'));
  }
  f.write(entry.auditReceiptPath,original);entry.artifact.bytes++;assert.ok((await f.run()).failures.includes('managed-site:artifact_identity_mismatch'));entry.artifact.bytes--;
  f.write(entry.artifact.path,'corrupted actual bytes');assert.ok((await f.run()).failures.includes('managed-site:artifact_digest_mismatch'));
 }finally{f.cleanup();}
});
test('provisioning binds the committed account, private worker, immutable version and exact DB',async()=>{
 const f=fixture();try{
  const path='.qa-output/resources.json',original=f.json(path);
  for(const mutate of [x=>{x.accountId='other'},x=>{x.worker='other'},x=>{x.versionId='latest'},x=>{x.observedAt=new Date(f.now-3600001).toISOString()},x=>{x.access.enabled=true},x=>{x.access.previews_enabled=true},x=>{x.bindings[0].id='business-db'},x=>{x.bindings.push({name:'SECRET',type:'secret_text'})}]){
   const proof=structuredClone(original);mutate(proof);f.write(path,proof);assert.equal((await f.run()).status,'blocked');
  }
 }finally{f.cleanup();}
});
