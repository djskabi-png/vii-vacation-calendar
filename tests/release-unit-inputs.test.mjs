import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join,dirname,sep} from 'node:path';
import {fingerprintUnit,collectUnitInputs,validateReusableArtifact} from '../tools/release-unit-inputs.mjs';

function fixture(){
 const root=mkdtempSync(resolve('.qa-output/unit-input-fixture-'));
 const write=(path,body)=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),body);};
 const git=args=>execFileSync('git',['-c','core.hooksPath='+join(root,'.empty-hooks'),'-c','commit.gpgsign=false','-c','user.name=Unit Fixture','-c','user.email=unit@example.test',...args],{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
 mkdirSync(join(root,'.empty-hooks'));
 git(['init','-q']);
 const files={
  '.gitignore':'.qa-output/\n.empty-hooks/\n',
  'package.json':'{"private":true}','pnpm-lock.yaml':'lockfileVersion: 9','tsconfig.json':'{"compilerOptions":{}}',
  '.openai/hosting.json':'{"project_id":"synthetic-site","d1":"DB"}',
  'app/page.tsx':'export default function Page(){return <h1>Fixture</h1>}',
  'app/style.css':'body{color:black}','worker/index.ts':'export default {}',
  'worker/image-helper.ts':'export const image=true','public/preserved.jpg':'photo',
  'build/style.mjs':'export const style=true','vite.config.ts':'export default {}',
  'drizzle/0001.sql':'CREATE TABLE preserved(id TEXT);',
  'shared/request-body.ts':'export const read=true;',
  'app/lib/quality-platform.ts':'export {schema} from "./schema-initializer.ts";',
  'app/lib/schema-initializer.ts':'export const schema=1;',
  'services/vii-quality-control/src/index.ts':'import "../../../app/lib/quality-platform.ts";export default {};',
  'services/vii-quality-control/src/browser-profiles.ts':'export const profiles=[];',
  'services/vii-quality-browser/src/index.ts':'import "../engine-definition.json";export default {};',
  'services/vii-quality-browser/engine-definition.json':'{"files":["services/vii-quality-control/src/browser-profiles.ts"]}',
  'services/vii-edge-delivery/src/index.ts':'import "../../../shared/request-body.ts";export default {};',
  'services/vii-public-images/src/index.ts':'import "../../../worker/image-helper.ts";export default {};',
 };
 for(const prefix of ['vii-quality-control','vii-quality-browser','vii-edge-delivery','vii-public-images'])files['services/'+prefix+'/wrangler.toml']='main = "src/index.ts"\n';
 for(const [path,body] of Object.entries(files))write(path,body);
 const commit=message=>{git(['add','.']);git(['commit','-qm',message]);return git(['rev-parse','HEAD']);};
 const base=commit('base synthetic source'),bytes='immutable compiled artifact',digest=createHash('sha256').update(bytes).digest('hex');
 write('.qa-output/candidate.tar',bytes);
 const fingerprint=(source=base,unit='managed-site')=>fingerprintUnit({root,source,unit});
 const receipt=(unit='managed-site')=>({schemaVersion:1,status:'passed',engine:'build',exitCode:0,unit,source:base,tree:git(['rev-parse',base+'^{tree}']),inputFingerprint:fingerprint(base,unit).fingerprint,artifactSha256:digest,observedAt:new Date().toISOString()});
 return{root,base,git,write,commit,fingerprint,receipt,async validate(source,changes={}){return validateReusableArtifact({root,source,unit:'managed-site',receipt:receipt(),artifactPath:'.qa-output/candidate.tar',...changes});},cleanup(){assert.ok(root.startsWith(resolve('.qa-output')+sep));rmSync(root,{recursive:true,force:true});}};
}

test('real ancestor commits changing docs and private controller reuse the exact Site artifact',async()=>{
 const f=fixture();try{
  f.write('project_knowledge/notes.md','documentation');const docs=f.commit('docs only');
  assert.notEqual(docs,f.base);assert.equal(f.fingerprint(docs).fingerprint,f.fingerprint().fingerprint);
  assert.equal((await f.validate(docs)).status,'reusable');
  f.write('services/vii-quality-control/src/index.ts','import "../../../app/lib/quality-platform.ts";export default {changed:true};');
  const privateOnly=f.commit('controller only');
  assert.equal(f.fingerprint(privateOnly).fingerprint,f.fingerprint().fingerprint);
  assert.notEqual(f.fingerprint(privateOnly,'quality-controller').fingerprint,f.fingerprint(f.base,'quality-controller').fingerprint);
  assert.equal((await f.validate(privateOnly)).artifactSource,f.base);
 }finally{f.cleanup();}
});

test('private unit closure includes transitive app/shared inputs and declared browser definition files',()=>{
 const f=fixture();try{
  assert.ok(collectUnitInputs({root:f.root,source:f.base,unit:'quality-controller'}).some(x=>x.path==='app/lib/schema-initializer.ts'));
  assert.ok(collectUnitInputs({root:f.root,source:f.base,unit:'quality-browser'}).some(x=>x.path==='services/vii-quality-control/src/browser-profiles.ts'));
  assert.ok(collectUnitInputs({root:f.root,source:f.base,unit:'image-delivery'}).some(x=>x.path==='worker/image-helper.ts'));
  const before=f.fingerprint(f.base,'quality-controller').fingerprint;
  f.write('app/lib/schema-initializer.ts','export const schema=2;');const changed=f.commit('transitive dependency changed');
  assert.notEqual(f.fingerprint(changed,'quality-controller').fingerprint,before);
  f.write('services/vii-quality-control/src/index.ts','import "./missing.ts";');const missing=f.commit('unresolved dependency');
  assert.throws(()=>f.fingerprint(missing,'quality-controller'),/build_dependency_missing/);
 }finally{f.cleanup();}
});

test('Site inventory includes media, build configuration, hosting and migrations',async()=>{
 const f=fixture();try{
  const paths=collectUnitInputs({root:f.root,source:f.base,unit:'managed-site'}).map(x=>x.path);
  for(const required of ['public/preserved.jpg','build/style.mjs','vite.config.ts','.openai/hosting.json','drizzle/0001.sql'])assert.ok(paths.includes(required),required);
  f.write('public/preserved.jpg','changed photo');const changed=f.commit('public media changed');
  await assert.rejects(f.validate(changed),/input_fingerprint_mismatch/);
 }finally{f.cleanup();}
});

test('missing digest, altered bytes, invalid timestamps and actual dirty state all block reuse',async()=>{
 const f=fixture();try{
  await assert.rejects(f.validate(f.base,{receipt:{...f.receipt(),artifactSha256:undefined}}),/receipt_invalid/);
  await assert.rejects(f.validate(f.base,{receipt:{...f.receipt(),inputFingerprint:'f'.repeat(64)}}),/fingerprint_mismatch/);
  await assert.rejects(f.validate(f.base,{receipt:{...f.receipt(),observedAt:'invalid'}}),/receipt_invalid/);
  await assert.rejects(f.validate(f.base,{receipt:{...f.receipt(),observedAt:'2100-01-01T00:00:00Z'}}),/receipt_invalid/);
  f.write('.qa-output/candidate.tar','tampered');await assert.rejects(f.validate(f.base),/artifact_digest_mismatch/);
  f.write('untracked-source.ts','unsafe change');await assert.rejects(f.validate(f.base),/working_tree_dirty/);
  assert.equal(f.fingerprint().source,f.base);
 }finally{f.cleanup();}
});

test('old immutable build receipts retain their original date and still require exact inputs and bytes',async()=>{
 const f=fixture();try{
  const old={...f.receipt(),observedAt:'2020-01-01T00:00:00Z'};
  assert.equal((await f.validate(f.base,{receipt:old})).status,'reusable');
  assert.equal(old.observedAt,'2020-01-01T00:00:00Z');
  f.write('public/preserved.jpg','changed media');const changed=f.commit('changed actual artifact input');
  await assert.rejects(f.validate(changed,{receipt:old}),/input_fingerprint_mismatch/);
 }finally{f.cleanup();}
});

test('an identical tree without ancestry and unknown unit cannot claim a retained build',async()=>{
 const f=fixture();try{
  const receipt=f.receipt();f.git(['checkout','--orphan','unrelated']);const unrelated=f.commit('unrelated tree');
  await assert.rejects(f.validate(unrelated,{receipt}),/source_not_ancestor/);
  assert.throws(()=>f.fingerprint(f.base,'unknown'),/unknown_build_unit/);
 }finally{f.cleanup();}
});

test('unresolved aliases and opaque dynamic imports fail rather than omitting their inputs',()=>{
 const f=fixture();try{
  f.write('tsconfig.json','{"compilerOptions":{"paths":{"internal/*":["./shared/*"]}}}');
  f.write('services/vii-quality-control/src/index.ts','import "internal/request-body";');const alias=f.commit('unsupported local alias');
  assert.throws(()=>f.fingerprint(alias,'quality-controller'),/unresolved_build_alias/);
  f.write('services/vii-quality-control/src/index.ts','export const load=path=>import(path);');const dynamic=f.commit('opaque import');
  assert.throws(()=>f.fingerprint(dynamic,'quality-controller'),/opaque_build_dependency/);
 }finally{f.cleanup();}
});
