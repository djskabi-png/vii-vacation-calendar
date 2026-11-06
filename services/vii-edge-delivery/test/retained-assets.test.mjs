import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeRetainedAsset,readRetainedAsset,retainedAssetKey,retainedAssetRequest} from '../src/retained-assets.ts';
import worker from '../src/index.ts';
const path='/assets/old-calendar-close-v25-Abcd1234.js',source='a'.repeat(40),buildId='11111111-2222-3333-4444-555555555555';
const body=new TextEncoder().encode('export const original="preserved";');
async function fixture(){
 const now=Date.now(),identity={path,source,buildId,createdAt:now,retainUntil:now+7*86400000},bytes=await encodeRetainedAsset(identity,body,now);
 let reads=0;const bucket={async get(key){reads++;assert.equal(key,await retainedAssetKey(path));return{size:bytes.length,body:new Blob([bytes]).stream()};},async put(){throw Error('Read-only runtime');}};
 return{now,identity,bytes,bucket,reads:()=>reads,request:new Request('https://vii.spaplus.co'+path)};
}
test('exact previous hashed asset bytes retain immutable identity without origin metadata',async()=>{
 const f=await fixture(),response=await readRetainedAsset(f.request,f.bucket,{now:f.now});assert.equal(response.status,200);assert.equal(await response.text(),new TextDecoder().decode(body));assert.equal(response.headers.get('X-VII-Asset-Build'),buildId);assert.match(response.headers.get('Content-Type'),/javascript/);assert.equal(response.headers.get('Set-Cookie'),null);
 const head=await readRetainedAsset(new Request(f.request,{method:'HEAD'}),f.bucket,{now:f.now});assert.equal(await head.text(),'');assert.equal(head.headers.get('Content-Length'),String(body.length));
});
test('only public hashed static paths participate, never private/action/range/query requests',async()=>{
 const f=await fixture();
 for(const request of [new Request('https://other.test'+path),new Request('https://vii.spaplus.co/assets/current.js'),new Request(f.request.url+'?v=1'),new Request(f.request,{method:'POST'}),new Request(f.request,{headers:{Authorization:'Bearer synthetic'}}),new Request(f.request,{headers:{Range:'bytes=0-1'}}),new Request(f.request,{headers:{'Next-Action':'synthetic'}})]){
  assert.equal(retainedAssetRequest(request),false);assert.equal(await readRetainedAsset(request,f.bucket),undefined);
 }
 assert.equal(f.reads(),0);
});
test('an authoritative empty compiled JS module stays empty instead of being dropped',async()=>{
 const f=await fixture(),encoded=await encodeRetainedAsset(f.identity,new Uint8Array(),f.now);
 const response=await readRetainedAsset(f.request,{async get(){return{size:encoded.length,body:new Blob([encoded]).stream()}}},{now:f.now});
 assert.equal(response.status,200);assert.equal(response.headers.get('Content-Length'),'0');assert.equal(await response.text(),'');
});
test('expired, wrong-path, corrupted and oversized objects never supply substitute code',async()=>{
 const f=await fixture();
 assert.equal(await readRetainedAsset(f.request,f.bucket,{now:f.identity.retainUntil}),undefined);
 const wrong=await encodeRetainedAsset({...f.identity,path:'/assets/other-Abcd1234.js'},body,f.now);
 const tampered=f.bytes.slice();tampered[tampered.length-1]^=1;
 for(const value of [wrong,tampered,new Uint8Array([0,0,16,1,1])]){
  const bucket={async get(){return{size:value.length,body:new Blob([value]).stream()}}};assert.equal(await readRetainedAsset(f.request,bucket,{now:f.now}),undefined);
 }
 let cancelled=false;assert.equal(await readRetainedAsset(f.request,{async get(){return{size:9*1024*1024,body:new ReadableStream({cancel(){cancelled=true}})}}},{now:f.now}),undefined);assert.equal(cancelled,true);
 await assert.rejects(encodeRetainedAsset({...f.identity,retainUntil:f.now+15*86400000},body,f.now),/identity_invalid/);
});
test('deadline and abort cancel stalled or late storage bodies without blocking the origin fallback',async()=>{
 const f=await fixture();let cancelled=0;
 const stalled={async get(){return{size:f.bytes.length,body:new ReadableStream({cancel(){cancelled++}})}}};
 assert.equal(await readRetainedAsset(f.request,stalled,{timeoutMs:15}),undefined);assert.equal(cancelled,1);
 let resolve;const pending=new Promise(r=>{resolve=r});assert.equal(await readRetainedAsset(f.request,{get(){return pending}},{timeoutMs:15}),undefined);
 resolve({size:f.bytes.length,body:new ReadableStream({cancel(){cancelled++}})});await new Promise(r=>setTimeout(r,5));assert.equal(cancelled,2);
 const controller=new AbortController();controller.abort();assert.equal(await readRetainedAsset(new Request(f.request,{signal:controller.signal}),f.bucket),undefined);assert.equal(f.reads(),0);
 const active=new AbortController();const work=readRetainedAsset(new Request(f.request,{signal:active.signal}),stalled);await new Promise(r=>setTimeout(r,2));active.abort();assert.equal(await work,undefined);assert.equal(cancelled,3);
});
test('actual Edge handler consults retention only after missing asset; current and private paths stay intact',async()=>{
 const f=await fixture(),original=globalThis.fetch;let status=200,originCalls=0;
 globalThis.fetch=async()=>{originCalls++;return new Response(status===200?'current asset':'not found',{status,headers:{'Content-Type':'text/javascript','Set-Cookie':'synthetic=origin'}})};
 try{
  const env={PUBLIC_CACHE:f.bucket},ctx={waitUntil(){}};
  const current=await worker.fetch(f.request,env,ctx);assert.equal(await current.text(),'current asset');assert.equal(f.reads(),0);
  status=404;const retained=await worker.fetch(f.request,env,ctx);assert.equal(await retained.text(),new TextDecoder().decode(body));assert.equal(f.reads(),1);assert.equal(retained.headers.get('Set-Cookie'),null);
  const privateResponse=await worker.fetch(new Request('https://vii.spaplus.co/account'),env,ctx);assert.equal(privateResponse.status,404);assert.equal(f.reads(),1);assert.equal(originCalls,3);
  status=503;assert.equal((await worker.fetch(f.request,env,ctx)).status,503);assert.equal(f.reads(),1);
 }finally{globalThis.fetch=original;}
});
