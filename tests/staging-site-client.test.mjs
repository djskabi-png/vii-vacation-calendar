import test from 'node:test';
import assert from 'node:assert/strict';
import {createStagingHealthClient,STAGE_HEALTH_URL,STAGE_HEALTH_ADMIN_PATH} from '../infrastructure/http/staging-site-client.mjs';
const now=Date.parse('2026-10-18T08:00:00Z');
const credentials={environment:'staging',clientId:'a'.repeat(32)+'.access',clientSecret:'synthetic-not-a-real-secret',expiresAt:'2026-10-18T20:00:00Z'};
const good={ok:true,databaseConnected:true,readOnly:true,markerMatched:true};
const request=(path=STAGE_HEALTH_ADMIN_PATH,method='GET')=>new Request('https://site.example.test'+path,{method,headers:{cookie:'owner-session-must-not-forward','Cf-Access-Authenticated-User-Email':'owner@example.test'}});
function harness(overrides={}) {
 const calls=[];
 const handle=createStagingHealthClient({authorize:async()=>true,getCredentials:async()=>{calls.push('credentials');return credentials;},fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(good);},now:()=>now,...overrides});
 return {handle,calls};
}
test('unauthorized/spoofed/failed identity cannot read credentials or make network calls',async()=>{
 for(const authorize of [async()=>false,async()=>null,async()=>({email:'owner@example.test'}),async()=>{throw Error('sensitive');}]){
  const h=harness({authorize});assert.equal((await h.handle(request())).status,403);assert.deepEqual(h.calls,[]);
 }
});
test('method, arbitrary path and queries never reach credentials/network',async()=>{
 for(const [path,method,status] of [[STAGE_HEALTH_ADMIN_PATH,'POST',405],['/arbitrary','GET',404],[STAGE_HEALTH_ADMIN_PATH+'?url=https://attacker.test','GET',400]]){
  const h=harness();assert.equal((await h.handle(request(path,method))).status,status);assert.deepEqual(h.calls,[]);
 }
});
test('missing, expired, overlong-lived, wrong environment and invalid header configuration fail closed',async()=>{
 for(const c of [null,{}, {...credentials,environment:'production'}, {...credentials,expiresAt:'2026-10-18T07:59:59Z'}, {...credentials,expiresAt:'2026-10-19T08:00:01Z'}, {...credentials,expiresAt:Symbol('not-a-date')}, {...credentials,expiresAt:{toString(){throw Error('private');}}}, {...credentials,clientId:'caller-controlled'}, {...credentials,clientSecret:'secret\r\nInjected: true'}]){
  let fetched=0;const h=harness({getCredentials:async()=>c,fetchImpl:async()=>{fetched++;return Response.json(good);}});
  assert.equal((await h.handle(request())).status,503);assert.equal(fetched,0);
 }
});
test('success calls only fixed HTTPS with allowlisted service headers and returns exact booleans',async()=>{
 const h=harness();const r=await h.handle(request());assert.equal(r.status,200);assert.deepEqual(await r.json(),good);
 const call=h.calls[1];assert.equal(call.url,STAGE_HEALTH_URL);assert.equal(call.options.redirect,'error');assert.equal(call.options.credentials,'omit');assert.equal(call.options.cache,'no-store');assert.equal(call.options.method,'GET');
 assert.deepEqual(call.options.headers,{accept:'application/json','CF-Access-Client-Id':credentials.clientId,'CF-Access-Client-Secret':credentials.clientSecret});
 assert.equal(call.options.body,undefined);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.ok(r.headers.get('x-robots-tag').includes('noindex'));
});
test('redirect, failed HTTP, HTML, malformed JSON, extra private data and nontrue flags are rejected',async()=>{
 for(const make of [()=>new Response('',{status:302,headers:{location:'https://attacker.test'}}),()=>new Response('sensitive',{status:500}),()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}}),()=>new Response('{bad',{headers:{'content-type':'application/json'}}),()=>Response.json({...good,email:'private@example.test'}),()=>Response.json({...good,readOnly:false}),()=>Response.json([])]){
  const h=harness({fetchImpl:async()=>make()});const r=await h.handle(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false});
 }
});
test('body limit checks both declared bytes and chunked bytes and cancels oversized streams',async()=>{
 let cancelled=0;
 for(const response of [new Response('x',{headers:{'content-type':'application/json','content-length':'99999'}}),new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(300));c.enqueue(new Uint8Array(300));},cancel(){cancelled++;}}),{headers:{'content-type':'application/json'}})]){
  const h=harness({fetchImpl:async()=>response});assert.equal((await h.handle(request())).status,503);
 }
 assert.equal(cancelled,1);
});
test('overall deadline aborts stalled upstream and masks connection/credential failures',async()=>{
 let aborted=false;
 const h=harness({deadlineMs:15,fetchImpl:async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('secret origin'));},{once:true}))});
 assert.equal((await h.handle(request())).status,503);assert.equal(aborted,true);
 for(const override of [{getCredentials:async()=>{throw Error('private-secret');}},{fetchImpl:async()=>{throw Error('private-secret');}}]){
  const r=await harness(override).handle(request());assert.equal(r.status,503);assert.equal(await r.text(),'{"ok":false}');
 }
});
test('a successful first request is never cached as health for a failed second request',async()=>{
 let calls=0;const h=harness({fetchImpl:async()=>{calls++;if(calls===2)throw Error('down');return Response.json(good);}});
 assert.equal((await h.handle(request())).status,200);assert.equal((await h.handle(request())).status,503);assert.equal(calls,2);
});
test('deadline covers a stalled response body and configuration clock errors stay generic',async()=>{
 let cancelled=false;
 const response=new Response(new ReadableStream({start(){},cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}});
 const h=harness({deadlineMs:15,fetchImpl:async()=>response});const r=await h.handle(request());
 assert.equal(r.status,503);assert.equal(cancelled,true);
 const broken=harness({now:()=>{throw Error('private clock context');}});assert.equal((await broken.handle(request())).status,503);assert.deepEqual(broken.calls,['credentials']);
});
test('oversized deadline and nonfunctional dependencies are rejected at construction',()=>{
 for(const change of [{deadlineMs:8001},{authorize:null},{getCredentials:null},{fetchImpl:null}])assert.throws(()=>createStagingHealthClient({authorize:async()=>true,getCredentials:async()=>credentials,...change}),/invalid_private_health_dependencies/);
});
