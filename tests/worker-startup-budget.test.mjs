import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditWorkerStartup, verifyServerLiteralImports } from '../scripts/verify-worker-startup-budget.mjs';

test('compiled startup budget follows static imports and reexports but excludes lazy modules',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'vii-startup-'));
  try {
    await writeFile(join(dir,'entry.js'),'import {v} from "./shared.js"; export {v}; const lazy=()=>import("./large.js");');
    await writeFile(join(dir,'shared.js'),'export {v} from "./leaf.js";');
    await writeFile(join(dir,'leaf.js'),'export const v=1;');
    await writeFile(join(dir,'large.js'),'export const text="'+'x'.repeat(4096)+'";');
    const result=await auditWorkerStartup(join(dir,'entry.js'),1024);
    assert.equal(result.modules,3);assert.ok(result.bytes<1024);
    await writeFile(join(dir,'shared.js'),'export {text as v} from "./large.js";');
    await assert.rejects(auditWorkerStartup(join(dir,'entry.js'),1024),/exceeds.*budget/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('compiled integrity rejects unmapped lazy data imports rather than publishing a broken fallback',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'vii-imports-'));
  try {
    await writeFile(join(dir,'entry.js'),'export const load=()=>import("./missing.json", {with:{type:"json"}});');
    await assert.rejects(verifyServerLiteralImports(dir),/Missing compiled server imports/);
    await writeFile(join(dir,'missing.json'),'{}');
    assert.equal((await verifyServerLiteralImports(dir)).literalImports,'all resolved');
  } finally {await rm(dir,{recursive:true,force:true});}
});
