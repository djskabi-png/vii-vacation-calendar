import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs'; import { stripTypeScriptTypes } from 'node:module';
const source=stripTypeScriptTypes(readFileSync(new URL('../src/evidence.ts',import.meta.url),'utf8'),{mode:'strip'}).replace(/^export /gm,''); const api=new Function(`${source};return {evidenceKey,parseEvidenceKey,readEvidence,MAX_EVIDENCE_BYTES};`)();
const good={sourceVersion:'a'.repeat(40),jobId:'job-1234',device:'mobile',scenario:'gallery-next'};
const store=(bytes=new Uint8Array([0xff,0xd8,0xff,0xd9]),contentType='image/jpeg')=>({get:async key=>({body:new Response(bytes).body,httpMetadata:{contentType},customMetadata:{}})});
test('derives and parses only the exact evidence key',()=>{const key=api.evidenceKey(good);assert.deepEqual(api.parseEvidenceKey(key),good);assert.throws(()=>api.evidenceKey({...good,sourceVersion:'bad'}),/identity_invalid/);assert.equal(api.parseEvidenceKey('https://evil/x.jpg'),null);});
test('reads bounded jpeg evidence',async()=>{const out=await api.readEvidence(store(),good);assert.equal(out.key,api.evidenceKey(good));assert.deepEqual([...out.body],[0xff,0xd8,0xff,0xd9]);assert.equal(await api.readEvidence(store(new Uint8Array(3),'image/png'),good),null);});
test('rejects oversized evidence and invalid identities',async()=>{await assert.rejects(api.readEvidence(store(new Uint8Array(api.MAX_EVIDENCE_BYTES+1)),good),/evidence_too_large/);await assert.rejects(api.readEvidence(store(),{...good,scenario:'../../secret'}),/identity_invalid/);});

test('bounds a stalled object lookup and cancels an object arriving after expiry',async()=>{
 let resolveGet,cancelled=0;const waiting=new Promise(resolve=>{resolveGet=resolve;});
 await assert.rejects(api.readEvidence({get:()=>waiting},good,{timeoutMs:10}),/read_timeout/);
 resolveGet({body:new ReadableStream({cancel(){cancelled++;}}),httpMetadata:{contentType:'image/jpeg'}});await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,1);
});
test('missing MIME and oversized metadata cancel the unused body; abort interrupts a stalled read',async()=>{
 let cancelled=0;const object=(metadata)=>({body:new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled++;}}),...metadata});
 assert.equal(await api.readEvidence({get:async()=>object({httpMetadata:{contentType:'image/png'}})},good),null);
 await assert.rejects(api.readEvidence({get:async()=>object({httpMetadata:{contentType:'image/jpeg'},size:1000001})},good),/too_large/);
 const controller=new AbortController();const pending=api.readEvidence({get:async()=>object({httpMetadata:{contentType:'image/jpeg'}})},good,{signal:controller.signal});controller.abort();await assert.rejects(pending,/read_cancelled/);assert.equal(cancelled,3);
});
