import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryJson } from '../app/lib/discovery-client-cache.ts';

test('deadline covers JSON body after headers and the one changed retry can recover',async()=>{
 const original=globalThis.fetch;const signals=[];let calls=0;
 try {
  globalThis.fetch=async(_url,init)=>{signals.push(init.signal);calls++;return calls===1?{ok:true,json:()=>new Promise(()=>{})}:Response.json({offers:[{id:42}]});};
  const result=await discoveryJson('/api/qa-body-deadline','recovery',{timeoutMs:15,retries:1});
  assert.deepEqual(result,{offers:[{id:42}]});assert.equal(calls,2);assert.equal(signals[0].aborted,true);assert.equal(signals[1].aborted,false);
 }finally{globalThis.fetch=original;}
});
test('a stalled response body reaches a terminal timeout and POST never retries',async()=>{
 const original=globalThis.fetch;let calls=0;
 try {
  globalThis.fetch=async()=>{calls++;return {ok:true,json:()=>new Promise(()=>{})};};
  await assert.rejects(discoveryJson('/api/qa-post-body','post',{method:'POST',body:'fixture',timeoutMs:15,retries:1}),error=>error.name==='TimeoutError');assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
test('a nontransient response is rejected before parsing and without a retry',async()=>{
 const original=globalThis.fetch;let calls=0;
 try {
  globalThis.fetch=async()=>{calls++;return {ok:false,status:404,json:()=>{throw Error('must not parse errorbody');}};};
  await assert.rejects(discoveryJson('/api/qa-404-body','not-found',{timeoutMs:15,retries:1}));assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
