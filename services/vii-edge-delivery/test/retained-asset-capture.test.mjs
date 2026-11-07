import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { captureRetainedAssets, verifyRetainedPredecessor, inspectExistingRetainedAsset } from '../scripts/capture-retained-assets.mjs';
import { encodeRetainedAsset, retainedAssetKey } from '../src/retained-assets.ts';
const source = 'a'.repeat(40), buildId = '11111111-2222-3333-4444-555555555555';
test('publication handoff rejects missing, pending, wrong-predecessor and uncertain retention receipts',()=>{
 const sha='b'.repeat(64),receipt={state:'complete',source,archiveSha256:sha,count:2,writes:[{key:'one',state:'verified'}]};
 assert.equal(verifyRetainedPredecessor(receipt,source,sha),true);
 for(const bad of [{...receipt,state:'writing'},{...receipt,source:'c'.repeat(40)},{...receipt,archiveSha256:'d'.repeat(64)},{...receipt,writes:[{key:'one',state:'reconciliation_required'}]}])assert.throws(()=>verifyRetainedPredecessor(bad,source,sha),/not_verified/);
});
function fixture() {
  const folder = mkdtempSync(join(tmpdir(), 'vii-retention-test-'));
  const rows = ['first-Abcd1234.js', 'second-Efgh5678.js'].map((file, i) => {
    const body = Buffer.from(`export const value=${i};`); writeFileSync(join(folder, file), body);
    return { file, path: '/assets/'+file, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex'), body };
  });
  return { folder, rows, plan: {schemaVersion:1,source,buildId,assets:rows.map(({body,...row})=>row)}, cleanup(){rmSync(folder,{recursive:true});} };
}
test('capture preflights every object before a single write, skips only verified predecessor bytes and verifies PUT',async()=>{
 const f=fixture(),objects=new Map(),events=[],now=Date.now();
 try {
  const key=await retainedAssetKey(f.rows[0].path);
  objects.set(key,await encodeRetainedAsset({path:f.rows[0].path,source,buildId,createdAt:now,retainUntil:now+8*86400000},f.rows[0].body,now));
  const receipt={state:'reserved_before_preflight'},snapshots=[];
  await captureRetainedAssets(f.plan,f.folder,{async read(key){events.push('get:'+key);return objects.get(key)||null;},async write(key,bytes){assert.equal(snapshots.at(-1).writes.at(-1).state,'reserved_before_single_put');events.push('put:'+key);objects.set(key,bytes);}},receipt,r=>snapshots.push(structuredClone(r)),now);
  assert.equal(receipt.state,'complete');assert.equal(receipt.writes.length,1);assert.equal(receipt.writes[0].state,'verified');
  assert.ok(events[0].startsWith('get:'));assert.ok(events[1].startsWith('get:'));assert.ok(events[2].startsWith('put:'));
 } finally {f.cleanup();}
});
test('a conflict after an earlier missing object blocks ALL writes',async()=>{
 const f=fixture();let writes=0,reads=0;try{
  await assert.rejects(captureRetainedAssets(f.plan,f.folder,{async read(){return ++reads===1?null:new Uint8Array([1,2,3]);},async write(){writes++;}},{state:'reserved_before_preflight'},()=>{}),/existing_asset_conflict/);
  assert.equal(reads,2);assert.equal(writes,0);
 } finally {f.cleanup();}
});
test('an uncertain PUT stops the operation and cannot be repeated with its receipt',async()=>{
 const f=fixture();let writes=0;const receipt={state:'reserved_before_preflight'};const transport={async read(){return null;},async write(){writes++;throw Error('uncertain_network');}};
 try{
  await assert.rejects(captureRetainedAssets(f.plan,f.folder,transport,receipt,()=>{}),/uncertain_network/);
  assert.equal(writes,1);assert.equal(receipt.state,'reconciliation_required');
  await assert.rejects(captureRetainedAssets(f.plan,f.folder,transport,receipt,()=>{}),/existing_operation_requires_reconciliation/);assert.equal(writes,1);
 } finally {f.cleanup();}
});
test('changed source bytes fail before any remote read or write',async()=>{
 const f=fixture();let reads=0;try{
  writeFileSync(join(f.folder,f.rows[0].file),'changed');
  await assert.rejects(captureRetainedAssets(f.plan,f.folder,{async read(){reads++;return null;}},{state:'reserved_before_preflight'},()=>{}),/source_asset_digest_mismatch/);assert.equal(reads,0);
 } finally {f.cleanup();}
});

test('same path and bytes reuse a valid predecessor even when its build metadata is old', async () => {
 const f=fixture(),now=Date.now(),oldBuild='22222222-3333-4444-5555-666666666666';
 try {
  const encoded=await encodeRetainedAsset({path:f.rows[0].path,source,buildId:oldBuild,createdAt:now-1000,retainUntil:now+86400000},f.rows[0].body,now);
  const decision=await inspectExistingRetainedAsset(encoded,f.rows[0],now,3600000);
  assert.equal(decision.status,'reuse'); assert.equal(decision.buildId,oldBuild); assert.ok(decision.remainingMs>3600000);
 } finally { f.cleanup(); }
});

test('same path with different bytes is rejected before any write', async () => {
 const f=fixture(),now=Date.now();
 try {
  const other=Buffer.from('different bytes');
  const encoded=await encodeRetainedAsset({path:f.rows[0].path,source,buildId,createdAt:now-1000,retainUntil:now+86400000},other,now);
  const decision=await inspectExistingRetainedAsset(encoded,f.rows[0],now,0);
  assert.equal(decision.status,'conflict'); assert.equal(decision.reason,'existing_asset_body_digest_mismatch');
 } finally { f.cleanup(); }
});

test('expired predecessor is rejected, while a short valid retention requests one extension write', async () => {
 const f=fixture(),now=Date.now();
 try {
  const expired=await encodeRetainedAsset({path:f.rows[0].path,source,buildId,createdAt:now-86400000,retainUntil:now-1},f.rows[0].body,now-2);
  assert.equal((await inspectExistingRetainedAsset(expired,f.rows[0],now,0)).status,'conflict');
  const short=await encodeRetainedAsset({path:f.rows[0].path,source,buildId,createdAt:now-1000,retainUntil:now+1000},f.rows[0].body,now);
  const decision=await inspectExistingRetainedAsset(short,f.rows[0],now,5000);
  assert.equal(decision.status,'extend'); assert.equal(decision.remainingMs,1000);
 } finally { f.cleanup(); }
});
