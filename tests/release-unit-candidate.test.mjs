import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fingerprintUnit} from '../tools/release-unit-inputs.mjs';
import {auditUnitCandidate} from '../tools/release-unit-candidate.mjs';

function fixture(){
 const root=resolve('.qa-output','unit-manifest-'+randomUUID());mkdirSync(root,{recursive:true});
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const write=(path,value)=>{mkdirSync(dirname(resolve(root,path)),{recursive:true});writeFileSync(resolve(root,path),typeof value==='string'?value:JSON.stringify(value));};
 const json=path=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
 git(['init','-q']);git(['config','user.name','Synthetic QA']);git(['config','user.email','qa@example.test']);
 write('project_knowledge/note.txt','seed');git(['add','.']);git(['commit','-qm','synthetic seed']);const baseline=git(['rev-parse','HEAD']);
 const contract={schemaVersion:1,accountId:'synthetic-account',units:{'quality-controller':{worker:'synthetic-controller',bindings:[{name:'QUALITY_DB',type:'d1',id:'synthetic-quality-db'}]}}};
 const graph={schemaVersion:2,graphId:'synthetic-graph',baselineSource:baseline,buildUnits:{'managed-site':{source:'.openai/hosting.json'},'quality-controller':{source:'services/vii-quality-control/wrangler.toml',provisioningRequired:true}},entries:[{id:'fixture',ownerBox:'fixture',match:['project_knowledge/','shared/','app/','worker/','services/','.openai/','.gitignore','package.json','pnpm-lock.yaml']}],nodes:{fixture:{dependsOn:[],requiredChecks:[],requiredLocalTests:[],buildUnits:['managed-site','quality-controller']}}};
 const files={'.gitignore':'.qa-output/\n','package.json':'{"type":"module"}','pnpm-lock.yaml':'lockfileVersion: 9','.openai/hosting.json':'{"project_id":"synthetic"}','worker/index.ts':'export default {}','shared/value.ts':'export const value=1;','app/lib/quality-platform.ts':'export const qualityRegistry=[];','services/vii-quality-control/wrangler.toml':'main="src/index.ts"','services/vii-quality-control/src/index.ts':'import "../../../shared/value.ts";export default {};','project_knowledge/release_controls/vii-release-impact-graph.json':graph,'project_knowledge/release_controls/vii-private-quality-resources.json':contract,'project_knowledge/note.txt':'original'};
 Object.entries(files).forEach(([path,value])=>write(path,value));
 const commit=()=>{git(['add','.']);git(['commit','-qm','synthetic fixture']);return git(['rev-parse','HEAD']);};
 const base=commit(),tree=git(['rev-parse','HEAD^{tree}']),now=Date.now(),observedAt=new Date(now).toISOString();
 const unitArtifacts=[];
 for(const unit of ['managed-site','quality-controller']){
  const path='.qa-output/'+unit+'.tar',bytes='synthetic immutable bytes for '+unit,digest=createHash('sha256').update(bytes).digest('hex');write(path,bytes);
  const buildReceiptPath='.qa-output/'+unit+'-build.json',auditReceiptPath='.qa-output/'+unit+'-audit.json';
  write(buildReceiptPath,{schemaVersion:1,engine:'build',status:'passed',exitCode:0,unit,source:base,tree,observedAt,inputFingerprint:fingerprintUnit({root,source:base,unit}).fingerprint,artifactSha256:digest});
  write(auditReceiptPath,{schemaVersion:1,engine:'artifact-audit',status:'passed',unit,source:base,tree,observedAt,artifactSha256:digest,artifactBytes:Buffer.byteLength(bytes),failedCount:0,executedCheckIds:unit==='managed-site'?['artifact.fixture-exclusion','artifact.import-integrity']:['artifact.unit-import-integrity','artifact.private-bindings']});
  unitArtifacts.push({unit,artifact:{path,sha256:digest,bytes:Buffer.byteLength(bytes)},buildReceiptPath,auditReceiptPath,...(unit==='quality-controller'?{provisioningReceiptPath:'.qa-output/resources.json'}:{})});
 }
 write('.qa-output/resources.json',{schemaVersion:1,engine:'cloud-resource-readback',status:'passed',accountId:contract.accountId,worker:'synthetic-controller',versionId:'11111111-2222-3333-4444-555555555555',observedAt,access:{enabled:false,previews_enabled:false},bindings:contract.units['quality-controller'].bindings});
 write('project_knowledge/note.txt','descendant documentation');const source=commit();
 const manifest={schemaVersion:2,graphId:graph.graphId,impactBase:baseline,candidate:{source,tree:git(['rev-parse','HEAD^{tree}'])},unitArtifacts};
 return{root,base,source,git,write,json,commit,manifest,now,run:()=>auditUnitCandidate(manifest,{root,now}),cleanup(){assert.ok(root.startsWith(resolve('.qa-output')+sep));rmSync(root,{recursive:true,force:true});}};
}

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
