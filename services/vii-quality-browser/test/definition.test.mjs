import test from 'node:test';
import assert from 'node:assert/strict';
import definition from '../engine-definition.json' with {type:'json'};
import {browserDefinition} from '../build-definition.mjs';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join,dirname,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
test('engine, transport, profiles and pinned SDK changes require a new immutable definition',()=>{
 assert.deepEqual(definition,browserDefinition(),'Regenerate the browser definition and requalify both private consumers');
});

test('the actual deployment guard rejects a changed engine before packaging',()=>{
 const root=fileURLToPath(new URL('../../../',import.meta.url));
 const fixture=mkdtempSync(join(tmpdir(),'vii-browser-definition-'));
 try{
  for(const file of [...definition.files,'services/vii-quality-browser/engine-definition.json']){const destination=join(fixture,file);mkdirSync(dirname(destination),{recursive:true});copyFileSync(join(root,file),destination);}
  const script=join(fixture,'services/vii-quality-browser/build-definition.mjs');
  const original=spawnSync(process.execPath,[script],{encoding:'utf8'});assert.equal(original.status,0,original.stderr);
  const engine=join(fixture,'services/vii-quality-browser/src/engine.ts');writeFileSync(engine,readFileSync(engine,'utf8')+'\n// changed engine input\n');
  const changed=spawnSync(process.execPath,[script],{encoding:'utf8'});assert.notEqual(changed.status,0);assert.match(changed.stderr,/browser_definition_changed_regenerate_and_requalify/);
  assert.equal(JSON.parse(readFileSync(join(fixture,'services/vii-quality-browser/engine-definition.json'),'utf8')).sha256,definition.sha256);
 }finally{assert.equal(resolve(dirname(fixture)),resolve(tmpdir()));assert.ok(basename(fixture).startsWith('vii-browser-definition-'));rmSync(fixture,{recursive:true,force:true});}
});
