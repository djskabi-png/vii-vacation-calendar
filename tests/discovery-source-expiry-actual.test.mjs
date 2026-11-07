import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {discoveryJson} from '../app/lib/discovery-client-cache.ts';
import {isFreshHomeOffer,validHomeOfferResponse} from '../app/lib/home-offer-freshness.ts';
const beforeText=execFileSync('git',['show','5f8bca6b8b7c830b9bca46bf3649a27c688b3ccb:app/lib/discovery-client-cache.ts'],{encoding:'utf8'});
const beforeExports={};new Function('exports',ts.transpileModule(beforeText,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(beforeExports);
const offer=checked=>({availabilityStatus:'verified',cache:{checkedAt:new Date(checked).toISOString()},deals:[{siteID:42}]});
const options={freshMs:300_000,staleMs:3_600_000,shouldCache:value=>value.availabilityStatus==='verified'&&isFreshHomeOffer(value),validateResponse:validHomeOfferResponse};

test('actual v813 cache extends a59minute offer past source expiry; current cache discards it and bypasses HTTP cache',async()=>{
 const originalFetch=globalThis.fetch,originalNow=Date.now;let now=59*60_000;
 Date.now=()=>now;
 try{
  for(const [name,read]of[['v813',beforeExports.discoveryJson],['fixed',discoveryJson]]){
   now=59*60_000;let count=0;const cacheModes=[];
   globalThis.fetch=async(_url,init)=>{cacheModes.push(init.cache);return Response.json(offer(count++?now:0))};
   await read('/api/qa-source-expiry-'+name,'same-day',options);now=61*60_000;
   const result=await read('/api/qa-source-expiry-'+name,'same-day',options);
   if(name==='v813'){assert.equal(count,1);assert.equal(isFreshHomeOffer(result),false)}
   else{assert.equal(count,2);assert.equal(isFreshHomeOffer(result),true);assert.equal(cacheModes[1],'reload')}
  }
 }finally{globalThis.fetch=originalFetch;Date.now=originalNow}
});
test('expired200 HTTP response gets exactly one changed-cache GET and a fresh200 result',async()=>{
 const previous=globalThis.fetch;let calls=0;const cache=[];
 try{globalThis.fetch=async(_url,init)=>{calls++;cache.push(init.cache);assert.ok(!('validateResponse'in init));return Response.json(offer(calls===1?0:Date.now()))};
  const result=await discoveryJson('/api/qa-expired-http','current-clock',options);assert.equal(calls,2);assert.deepEqual(cache,['default','reload']);assert.equal(isFreshHomeOffer(result),true);
 }finally{globalThis.fetch=previous}
});
test('repeated expired200 responses stop, pending is never remembered, and POST never retries semantic failure',async()=>{
 const previous=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return Response.json(offer(0))};
  await assert.rejects(discoveryJson('/api/qa-expired-every-time','bounded',options),/discovery_invalid_response/);assert.equal(calls,2);
  calls=0;await assert.rejects(discoveryJson('/api/qa-expired-post','bounded',{...options,method:'POST'}),/discovery_invalid_response/);assert.equal(calls,1);
  calls=0;globalThis.fetch=async()=>Response.json(++calls===1?{availabilityStatus:'refreshing',deals:[]}:offer(Date.now()));
  assert.equal((await discoveryJson('/api/qa-pending-expiry','pending',options)).availabilityStatus,'refreshing');
  assert.equal((await discoveryJson('/api/qa-pending-expiry','pending',options)).availabilityStatus,'verified');assert.equal(calls,2);
 }finally{globalThis.fetch=previous}
});
