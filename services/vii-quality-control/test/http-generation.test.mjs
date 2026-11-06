import test from 'node:test';import assert from 'node:assert/strict';
import {verifyHttpTargetBuild,verifyHttpResponseBuild} from '../src/http-generation.ts';
import {fixture} from './fixture.mjs';
import {readQualityJob} from '../../../app/lib/quality-job-store.ts';
const build='11111111-2222-3333-4444-555555555555',other='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const input={origin:'https://vii.spaplus.co',buildId:build};
function document(generation=build){return new Response('<html></html>',{headers:{'Content-Type':'text/html','X-VII-Cache-Build':generation}});}

test('anonymous probe checks actual generation without following redirects or forwarding identity',async()=>{
 let calls=0;const result=await verifyHttpTargetBuild(input,async(url,init)=>{calls++;assert.equal(url,input.origin+'/');assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.headers.Cookie,undefined);assert.equal(init.headers.Authorization,undefined);return document();});assert.deepEqual(result,{status:'passed'});assert.equal(calls,1);
 assert.deepEqual(await verifyHttpTargetBuild(input,async()=>document(other)),{status:'blocked',reason:'observed_build_mismatch'});
 assert.deepEqual(await verifyHttpTargetBuild(input,async()=>new Response(null,{status:302,headers:{Location:'https://other.invalid'}})),{status:'blocked',reason:'target_generation_unavailable'});
 assert.equal((await verifyHttpTargetBuild({...input,origin:'https://other.invalid'},async()=>{throw Error('must not fetch')})).reason,'target_generation_invalid');
});

test('uncooperative late fetch is bounded, cancelled and never admitted afterward',async()=>{
 let resolveFetch,cancelled=0;const waiting=new Promise(resolve=>{resolveFetch=resolve;});
 assert.equal((await verifyHttpTargetBuild({...input,timeoutMs:10},()=>waiting)).status,'blocked');
 resolveFetch(new Response(new ReadableStream({cancel(){cancelled++;}}),{headers:{'Content-Type':'text/html','X-VII-Cache-Build':build}}));await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,1);
 const controller=new AbortController();controller.abort();let calls=0;await verifyHttpTargetBuild({...input,signal:controller.signal},async()=>{calls++;return document();});assert.equal(calls,0);
});

test('route response cannot hide an old HTML cache behind a matching generation probe',()=>{
 const uncached=new Response('<html/>',{headers:{'Content-Type':'text/html','X-VII-App-Build':build}});
 assert.equal(verifyHttpResponseBuild(uncached,build).status,200);
 const conflicting=new Response('<html/>',{headers:{'Content-Type':'text/html','X-VII-App-Build':build,'X-VII-Cache-Build':other}});
 assert.throws(()=>verifyHttpResponseBuild(conflicting,build),/observed_build_mismatch/);
 assert.equal(verifyHttpResponseBuild(document(),build).status,200);
 assert.throws(()=>verifyHttpResponseBuild(document(other),build),/observed_build_mismatch/);
 assert.throws(()=>verifyHttpResponseBuild(new Response('<html/>',{headers:{'Content-Type':'text/html'}}),build),/generation_unavailable/);
 // JSON APIs without document-build headers remain semantic/data checks. They
 // do not independently attest an image-worker or data-generation release.
 assert.equal(verifyHttpResponseBuild(Response.json({entries:[]}),build).status,200);
});

test('mismatched generation blocks the durable job before a content check or incident notification',async()=>{
 const f=fixture({verifyTarget:async()=>({status:'blocked',reason:'observed_build_mismatch'})});try{
  const admitted=await(await f.controller.handle(new Request(input.origin+'/api/admin/quality',{method:'POST'}),f.env,'fixture-admin',{action:'enqueue',idempotencyKey:'generation-negative-case',level:'full'})).json();
  assert.equal((await f.controller.consume(f.env,f.messages[0])).status,'blocked');
  const job=await readQualityJob(f.db,admitted.job.runId);assert.equal(job.status,'blocked');assert.equal(job.reason,'observed_build_mismatch');assert.equal(job.receipts.length,0);assert.equal(f.executions(),0);
  assert.equal(f.sqlite.prepare('SELECT status FROM quality_runs WHERE id=?').get(job.runId).status,'blocked');assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM quality_notification_outbox').get().n,0);
 }finally{f.sqlite.close();}
});

test('a failed probe cannot revoke a newer execution lease acquired during its request',async()=>{
 let f;f=fixture({verifyTarget:async()=>{f.sqlite.prepare("UPDATE quality_jobs SET status='running',lease_token='newer-owner',lease_until=?").run(new Date(Date.now()+60000).toISOString());return{status:'blocked',reason:'observed_build_mismatch'};}});
 try{await f.controller.handle(new Request(input.origin+'/api/admin/quality',{method:'POST'}),f.env,'fixture-admin',{action:'enqueue',idempotencyKey:'generation-racing-owner',level:'full'});assert.equal((await f.controller.consume(f.env,f.messages[0])).status,'not_claimed');assert.equal(f.sqlite.prepare('SELECT status,lease_token AS token FROM quality_jobs').get().token,'newer-owner');assert.equal(f.executions(),0);}finally{f.sqlite.close();}
});
