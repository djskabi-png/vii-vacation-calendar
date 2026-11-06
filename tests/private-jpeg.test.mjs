import test from 'node:test';import assert from 'node:assert/strict';
import {readPrivateJpeg} from '../shared/private-jpeg.ts';
const jpeg=new Uint8Array([255,216,255,217]);
const response=(body=jpeg,length=4)=>new Response(body,{headers:{'Content-Type':'image/jpeg','Content-Length':String(length),'Set-Cookie':'secret=not-forwarded'}});
test('checks actual JPEG bytes and declared length then strips every non-allowlisted header',async()=>{
 const good=await readPrivateJpeg(response());assert.equal(good.headers.get('set-cookie'),null);assert.equal(good.headers.get('x-content-type-options'),'nosniff');assert.deepEqual([...new Uint8Array(await good.arrayBuffer())],[...jpeg]);
 for(const value of [response(jpeg,5),response('evil',4),response(new Uint8Array(9),4),response(jpeg,1000001)])await assert.rejects(readPrivateJpeg(value),/invalid_evidence_response/);
});
test('a stalled body and caller cancellation cannot hold the private gateway open',async()=>{
 let cancelled=0;const stalled=()=>response(new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled++;}}));
 await assert.rejects(readPrivateJpeg(stalled(),{timeoutMs:10}),/invalid_evidence_response/);
 const controller=new AbortController();controller.abort();await assert.rejects(readPrivateJpeg(stalled(),{signal:controller.signal}),/invalid_evidence_response/);assert.equal(cancelled,2);
});
