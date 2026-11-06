import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
import {fixture} from './fixtures/release-unit-fixture.mjs';
import {captureWorkerPackage,auditWorkerPackage} from '../tools/worker-release-package.mjs';

function setup(){
 const f=fixture(),directory=resolve(f.root,'.qa-output/compiled'),artifactPath=resolve(f.root,'.qa-output/worker-package.json');
 f.write('.qa-output/compiled/index.js',"import value from './value.js';export default {fetch(){return value}};");
 f.write('.qa-output/compiled/value.js',"export default 'synthetic';");
 const options={unit:'quality-controller',directory,outputPath:artifactPath,root:f.root};
 return {...f,directory,artifactPath,options,capture:()=>captureWorkerPackage(options),audit:()=>auditWorkerPackage({unit:options.unit,source:f.source,root:f.root,artifactPath,compiledDirectory:directory})};
}
test('worker package preserves exact tested module bytes, isolates configuration and refuses overwrite',()=>{
 const f=setup();try{
  const receipt=f.capture(),audit=f.audit(),payload=JSON.parse(readFileSync(f.artifactPath,'utf8'));
  assert.equal(audit.status,'passed');assert.equal(audit.artifactSha256,receipt.artifactSha256);assert.equal(audit.modules,2);assert.equal(audit.imports,1);
  assert.ok(audit.executedCheckIds.includes('artifact.tested-payload-parity'));
  assert.deepEqual(Object.keys(payload).sort(),['entrypoint','inputFingerprint','modules','nodeCompat','schemaVersion','source','tree','unit']);
  assert.throws(()=>f.capture(),/EEXIST/);
  f.write('.qa-output/compiled/value.js',"export default 'different';");assert.throws(()=>f.audit(),/tested_payload_mismatch/);
 }finally{f.cleanup();}
});
test('unresolved, opaque, external and incompatible Node imports fail before creating package',()=>{
 const f=setup();try{for(const code of [
  "import './missing.js';export default {};",
  "import fs from 'node:fs';export default {};",
  "import x from 'unapproved-package';export default {};",
  "export default {fetch(n){return import(n)}};",
  "export const missingHandler=1;",
  "export default {",
 ]){f.write('.qa-output/compiled/index.js',code);assert.throws(()=>f.capture(),/worker_package_/);}
 }finally{f.cleanup();}
});
test('module path, module bytes, original tree and caller-selected source cannot be substituted',()=>{
 const f=setup();try{
  f.capture();const original=JSON.parse(readFileSync(f.artifactPath,'utf8'));
  for(const mutate of [x=>{x.modules[0].name='../index.js'},x=>{x.modules[0].body='YQ=='},x=>{x.modules.push(x.modules[0])},x=>{x.tree='0'.repeat(40)},x=>{x.nodeCompat=true}]){
   const value=structuredClone(original);mutate(value);writeFileSync(f.artifactPath,JSON.stringify(value));assert.throws(()=>f.audit(),/worker_package_/);
  }
  writeFileSync(f.artifactPath,JSON.stringify(original));assert.throws(()=>auditWorkerPackage({unit:'quality-controller',source:f.base,root:f.root,artifactPath:f.artifactPath,compiledDirectory:f.directory}),/source_mismatch/);
 }finally{f.cleanup();}
});
test('private fixtures and unknown runtime files cannot enter the executable package',()=>{
 const f=setup();try{
  f.write('.qa-output/compiled/fixture.json','{}');assert.throws(()=>f.capture(),/module_invalid/);
 }finally{f.cleanup();}
});
