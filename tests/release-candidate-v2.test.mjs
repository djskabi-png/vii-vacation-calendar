import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fixture} from './fixtures/release-unit-fixture.mjs';
import {auditReleaseCandidate} from '../tools/release-candidate.mjs';
import {releaseBuildIdentity} from '../scripts/release-build-identity.mjs';
import {auditFrozenUnitArtifact} from '../tools/release-unit-candidate.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const objectHash=value=>hash(JSON.stringify(value));
async function candidate(){
 const f=fixture({configure({graph,write}){
  graph.nodes.fixture.requiredChecks=['fixture.http'];
  graph.nodes.fixture.requiredLocalTests=['tests/actual.test.mjs'];
  graph.entries[0].match.push('tests/');
  write('tests/actual.test.mjs','export {};');
  write('app/lib/quality-platform.ts','export const qualityRegistry=[{checkId:"fixture.http"}];');
  write('project_knowledge/release_controls/vii-release-impact-graph.json',graph);
  write('project_knowledge/release_controls/vii-release-acceptance-policy.json',{
   schemaVersion:1,policyId:'synthetic-policy',browserFamilies:['fixture'],browserFixtureAllowedFamilies:[],
   unitAuditDefinitions:{'managed-site':'site-archive-v1','quality-controller':'worker-package-v1'},
   interfaces:[{id:'synthetic-interface',units:['managed-site','quality-controller'],definitionVersion:'synthetic-v1'}],
  });
 }});
 try {
  const m=f.manifest,observedAt=new Date(f.now).toISOString();
  Object.assign(m,{stage:'candidate',policyId:'synthetic-policy',changedFiles:f.git(['diff','--name-only',m.impactBase,f.source,'--']).split(/\r?\n/).filter(Boolean),sourceEvidencePath:'.qa-output/source.json',evidencePaths:[],configurationEvidencePaths:[],rollbackEvidencePaths:[],independentEvidencePath:'.qa-output/independent.json'});
  m.candidate.buildIdentity=releaseBuildIdentity({cwd:f.root});
  f.write(m.sourceEvidencePath,{verificationScope:'source-integrity-only',status:'passed',clean:true,head:f.source,tree:m.candidate.tree});
  const proofs=[];
  for(const entry of m.unitArtifacts){
   const audit=f.json(entry.auditReceiptPath);audit.definitionVersion=entry.unit==='managed-site'?'site-archive-v1':'worker-package-v1';
   if(entry.unit==='managed-site')audit.executedCheckIds.push('artifact.tested-payload-parity');
   f.write(entry.auditReceiptPath,audit);
   proofs.push(await auditFrozenUnitArtifact(entry,{root:f.root,source:f.source,now:f.now}));
  }
  proofs.sort((a,b)=>a.unit.localeCompare(b.unit));
  m.artifactSetSha256=objectHash(proofs.map(({unit,artifactSource,artifactTree,artifactSha256,artifactBytes,inputFingerprint})=>({unit,artifactSource,artifactTree,artifactSha256,artifactBytes,inputFingerprint})));
  const evidencePath='.qa-output/raw-observation.txt';f.write(evidencePath,'Synthetic test evidence. Never live acceptance.');
  const raw={evidencePath,evidenceSha256:hash('Synthetic test evidence. Never live acceptance.')};
  const configurations=[];
  for(const unit of ['managed-site','quality-controller']){
   const c={schemaVersion:1,engine:'environment-readback',status:'passed',unit,observedAt,configurationSha256:hash('current '+unit),previousConfigurationSha256:hash('previous '+unit),environmentRevision:12,bindingsVerified:true,targetBuildIdentity:m.candidate.buildIdentity,...raw};
   const path=`.qa-output/config-${unit}.json`;f.write(path,c);m.configurationEvidencePaths.push(path);configurations.push(c);
   const rollbackPath=`.qa-output/rollback-${unit}.json`;
   f.write(rollbackPath,{schemaVersion:1,engine:'rollback-readback',status:'passed',unit,observedAt,source:f.base,tree:f.git(['rev-parse',`${f.base}^{tree}`]),artifactSha256:hash('previous '+unit),deployment:'synthetic-previous-'+unit,environmentRevision:11,procedureVersion:'synthetic-v1',...raw});m.rollbackEvidencePaths.push(rollbackPath);
  }
  configurations.sort((a,b)=>a.unit.localeCompare(b.unit));
  m.candidate.environmentRevision=objectHash(configurations.map(({unit,configurationSha256,environmentRevision,targetBuildIdentity})=>({unit,configurationSha256,environmentRevision,targetBuildIdentity})));
  const receipt=extra=>({schemaVersion:2,status:'passed',source:f.source,tree:m.candidate.tree,buildIdentity:m.candidate.buildIdentity,artifactSetSha256:m.artifactSetSha256,environmentSetSha256:m.candidate.environmentRevision,observedAt,failedCount:0,blockedCount:0,cancelledCount:0,executedCheckIds:[],evidencePath,evidenceSha256:hash('Synthetic test evidence. Never live acceptance.'),...extra});
  for(const [name,extra] of [
   ['local',{engine:'local-test',exitCode:0,executedCheckIds:['tests/actual.test.mjs']}],
   ['http',{engine:'http',fixtureOnly:false,executedCheckIds:['fixture.http']}],
   ['desktop',{engine:'browser',fixtureOnly:false,family:'fixture',viewport:'desktop',executedCheckIds:['synthetic-interaction']}],
   ['mobile',{engine:'browser',fixtureOnly:false,family:'fixture',viewport:'mobile',executedCheckIds:['synthetic-interaction']}],
   ['integration',{engine:'integration',fixtureOnly:false,interfaceId:'synthetic-interface',definitionVersion:'synthetic-v1',executedCheckIds:['synthetic-interface-check']}],
  ]){const path=`.qa-output/${name}.json`;f.write(path,receipt(extra));m.evidencePaths.push(path);}
  f.write(m.independentEvidencePath,receipt({engine:'independent-review',operator:'synthetic-operator',checker:'synthetic-checker'}));
  return {...f,receipt,run:()=>auditReleaseCandidate(m,{root:f.root,now:f.now})};
 }catch(error){f.cleanup();throw error;}
}

test('complete local admission binds actual reusable artifacts but cannot confer publication authority',async()=>{
 const f=await candidate();try{const r=await f.run();assert.equal(r.status,'passed',JSON.stringify(r.failures));assert.equal(r.units.length,2);assert.ok(r.units.every(x=>x.reused));assert.equal(r.verificationOnly,true);assert.equal(r.privateAuthorityRequired,true);assert.equal(r.publicationApproved,false);assert.equal(r.publicReleaseVerified,false);}finally{f.cleanup();}
});
test('source-only verification changes still require their actual local tests and cannot claim a public change',async()=>{
 const f=fixture({configure({graph,write}){
  graph.nodes.fixture.buildUnits=[];graph.nodes.fixture.requiredLocalTests=['tests/tool.test.mjs'];graph.entries[0].match.push('tests/');
  write('tests/tool.test.mjs','export {};');write('project_knowledge/release_controls/vii-release-impact-graph.json',graph);
  write('project_knowledge/release_controls/vii-release-acceptance-policy.json',{schemaVersion:1,policyId:'synthetic-policy',interfaces:[],browserFamilies:[],browserFixtureAllowedFamilies:[]});
 }});
 try{
  Object.assign(f.manifest,{stage:'candidate',policyId:'synthetic-policy',unitArtifacts:[],changedFiles:f.git(['diff','--name-only',f.manifest.impactBase,f.source,'--']).split(/\r?\n/).filter(Boolean),sourceEvidencePath:'.qa-output/source.json',evidencePaths:[]});
  f.manifest.candidate.buildIdentity=releaseBuildIdentity({cwd:f.root});
  f.write(f.manifest.sourceEvidencePath,{verificationScope:'source-integrity-only',status:'passed',clean:true,head:f.source,tree:f.manifest.candidate.tree});
  const run=()=>auditReleaseCandidate(f.manifest,{root:f.root,now:f.now});
  assert.ok((await run()).failures.includes('required_local_test_missing:tests/tool.test.mjs'));
  f.write('.qa-output/raw.txt','synthetic');f.write('.qa-output/local.json',{schemaVersion:2,engine:'local-test',status:'passed',source:f.source,tree:f.manifest.candidate.tree,observedAt:new Date(f.now).toISOString(),exitCode:0,failedCount:0,blockedCount:0,cancelledCount:0,executedCheckIds:['tests/tool.test.mjs'],evidencePath:'.qa-output/raw.txt',evidenceSha256:hash('synthetic')});
  f.manifest.evidencePaths=['.qa-output/local.json'];const r=await run();assert.equal(r.status,'passed',JSON.stringify(r.failures));assert.equal(r.publicationApproved,false);
  f.manifest.publicDeployments=[];assert.ok((await run()).failures.includes('source_only_cannot_claim_runtime_change'));
 }finally{f.cleanup();}
});
test('missing mobile, HTTP, local-test and interface observations independently block admission',async()=>{
 const f=await candidate();try{for(const name of ['mobile','http','local','integration']){const paths=f.manifest.evidencePaths;f.manifest.evidencePaths=paths.filter(x=>!x.endsWith('/'+name+'.json'));assert.equal((await f.run()).status,'blocked',name);f.manifest.evidencePaths=paths;}}finally{f.cleanup();}
});
test('same-source receipt with changed artifact, environment, raw bytes or fixture browser cannot pass',async()=>{
 const f=await candidate();try{const path='.qa-output/mobile.json',original=f.json(path);for(const change of [x=>{x.artifactSetSha256='0'.repeat(64)},x=>{x.environmentSetSha256='0'.repeat(64)},x=>{x.evidenceSha256='0'.repeat(64)},x=>{x.fixtureOnly=true},x=>{x.cancelledCount=1},x=>{x.observedAt=new Date(f.now-86400001).toISOString()}]){const x=structuredClone(original);change(x);f.write(path,x);assert.equal((await f.run()).status,'blocked');}f.write(path,original);f.write(original.evidencePath,'altered');assert.equal((await f.run()).status,'blocked');}finally{f.cleanup();}
});
test('config target, incomplete rollback, stale bindings and operator self-review block admission',async()=>{
 const f=await candidate();try{
  const path=f.manifest.configurationEvidencePaths[0],config=f.json(path);
  for(const mutate of [x=>{x.targetBuildIdentity='wrong'},x=>{x.bindingsVerified=false},x=>{x.observedAt=new Date(f.now-3600001).toISOString()}]){const c=structuredClone(config);mutate(c);f.write(path,c);assert.equal((await f.run()).status,'blocked');}f.write(path,config);
  const rollback=f.manifest.rollbackEvidencePaths;f.manifest.rollbackEvidencePaths=[];assert.equal((await f.run()).status,'blocked');f.manifest.rollbackEvidencePaths=rollback;
  const seal=f.json(f.manifest.independentEvidencePath);seal.checker=seal.operator;f.write(f.manifest.independentEvidencePath,seal);assert.equal((await f.run()).status,'blocked');
 }finally{f.cleanup();}
});
test('published stage requires exact deployments and fresh public evidence for every changed unit',async()=>{
 const f=await candidate();try{
  f.manifest.stage='published';f.manifest.publicEvidencePaths=[];f.manifest.publicDeployments=[];assert.equal((await f.run()).status,'blocked');
  f.manifest.publicDeployments=f.manifest.unitArtifacts.map(e=>({unit:e.unit,deployment:'synthetic-current-'+e.unit,environmentRevision:12,origin:'https://example.invalid'}));
  for(const [i,deployment] of f.manifest.publicDeployments.entries()){
   const e=f.manifest.unitArtifacts.find(e=>e.unit===deployment.unit),b=f.json(e.buildReceiptPath),path=`.qa-output/public-${i}.json`;
   f.write(path,f.receipt({engine:'public-smoke',fixtureOnly:false,...deployment,deployedArtifactSha256:e.artifact.sha256,deployedSource:b.source,executedCheckIds:['synthetic-public-read']}));f.manifest.publicEvidencePaths.push(path);
  }
  const admitted=await f.run();assert.equal(admitted.status,'passed',JSON.stringify(admitted.failures));assert.equal(admitted.publicReleaseVerified,false);
  const path=f.manifest.publicEvidencePaths[0],r=f.json(path);r.deployedSource=f.source;f.write(path,r);assert.equal((await f.run()).status,'blocked');
 }finally{f.cleanup();}
});
