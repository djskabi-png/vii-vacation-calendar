import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { validateReleaseCandidate } from '../scripts/release-candidate-manifest.mjs';

function fixture() {
  const root=resolve('.qa-output',`manifest-test-${randomUUID()}`);mkdirSync(root,{recursive:true});
  const files=[],source='1'.repeat(40),tree='2'.repeat(40),now=Date.now();
  const digest=createHash('sha256').update('synthetic artifact').digest('hex');
  const write=(name,value)=>{files.push(name);writeFileSync(resolve(root,name),typeof value==='string'?value:JSON.stringify(value));return name;};
  write('artifact.zip','synthetic artifact');
  const receipt=extra=>({status:'passed',source,tree,artifactSha256:digest,observedAt:new Date(now).toISOString(),...extra});
  write('source.json',{verificationScope:'source-integrity-only',status:'passed',clean:true,head:source,tree});
  write('build.json',receipt({engine:'build',exitCode:0}));
  write('audit.json',receipt({engine:'artifact-audit',executedCheckIds:['artifact.fixture-exclusion','artifact.import-integrity']}));
  write('http.json',receipt({engine:'http',executedCheckIds:['global.home.semantic']}));
  write('rollback.json',{status:'passed',source:'3'.repeat(40),tree:'4'.repeat(40),deployment:'synthetic-deployment',environmentRevision:8,artifactSha256:'5'.repeat(64),procedureVersion:'restore-fixture-v1',observedAt:new Date(now).toISOString()});
  const graph={schemaVersion:2,graphId:'test-graph',buildUnits:{},entries:[{id:'fixture',ownerBox:'fixture',match:['fixture.ts']}],nodes:{fixture:{dependsOn:[],requiredChecks:['global.home.semantic'],buildUnits:[]}}};
  const manifest={schemaVersion:1,stage:'candidate',graphId:'test-graph',changedFiles:['fixture.ts'],candidate:{source,tree,artifact:{path:'artifact.zip',sha256:digest},environmentRevision:9},sourceEvidencePath:'source.json',evidencePaths:['build.json','audit.json','http.json'],rollbackEvidencePath:'rollback.json'};
  // Registry expansion still reads the real repository; only artifact receipt
  // paths and source identity are isolated fixtures.
  const repo=process.cwd();
  const options={root,registryRoot:repo,now,treeForSource:()=>tree,workingState:{source,dirty:false},graph,changedFiles:['fixture.ts']};
  return {root,source,tree,now,write,receipt,manifest,options,repo,cleanup(){for(const name of files)unlinkSync(resolve(root,name));rmdirSync(root);}};
}

test('missing or mismatched publication evidence fails closed',()=>{
  const f=fixture();try{
    const result=validateReleaseCandidate(f.manifest,f.options);
    assert.equal(result.status,'passed',JSON.stringify(result.failures));
    assert.equal(result.publicationApproved,true);
    assert.equal(result.publicReleaseVerified,false);
    const missing=validateReleaseCandidate({...f.manifest,evidencePaths:[],rollbackEvidencePath:'missing.json'},f.options);
    assert.ok(missing.failures.includes('build_not_verified'));
    assert.ok(missing.failures.includes('rollback_evidence_unavailable'));
    const dirty=validateReleaseCandidate(f.manifest,{...f.options,workingState:{source:f.source,dirty:true}});
    assert.ok(dirty.failures.includes('candidate_worktree_not_frozen'));
  }finally{f.cleanup();}
});

test('HTTP evidence cannot replace desktop/mobile browser evidence for a changed public component',()=>{
  const f=fixture();try{
    f.options.graph.entries[0].ownerBox='maps';
    f.options.graph.nodes.maps=f.options.graph.nodes.fixture;
    delete f.options.graph.nodes.fixture;
    const missing=validateReleaseCandidate(f.manifest,f.options);
    assert.ok(missing.failures.includes('browser_evidence_missing:maps:desktop'));
    assert.ok(missing.failures.includes('browser_evidence_missing:maps:mobile'));
    for(const viewport of ['desktop','mobile']) f.manifest.evidencePaths.push(f.write(`browser-${viewport}.json`,f.receipt({engine:'browser',family:'maps',viewport,environmentRevision:9})));
    assert.equal(validateReleaseCandidate(f.manifest,f.options).status,'passed');
    const published={...f.manifest,stage:'published',publicDeployment:{deployment:'synthetic-new-deployment',origin:'https://example.test',environmentRevision:10},publicEvidencePath:'public.json'};
    f.write('public.json',f.receipt({engine:'public-smoke',deployment:'different-deployment',origin:'https://example.test',environmentRevision:10}));
    assert.ok(validateReleaseCandidate(published,f.options).failures.includes('public_deployment_not_verified'));
  }finally{f.cleanup();}
});

test('candidate may not claim public deployment and stale or cross-source receipts are rejected',()=>{
  const f=fixture();try{
    f.write('other.json',f.receipt({engine:'build',source:'6'.repeat(40)}));
    const invalid=validateReleaseCandidate({...f.manifest,publicDeployment:{deployment:'invented'},evidencePaths:['other.json']},f.options);
    assert.ok(invalid.failures.includes('candidate_cannot_claim_public_deployment'));
    assert.ok(invalid.failures.includes('invalid_candidate_receipt:other.json'));
    f.write('stale.json',f.receipt({engine:'build',observedAt:new Date(f.now-25*60*60*1000).toISOString()}));
    assert.ok(validateReleaseCandidate({...f.manifest,evidencePaths:['stale.json']},f.options).failures.includes('invalid_candidate_receipt:stale.json'));
  }finally{f.cleanup();}
});
