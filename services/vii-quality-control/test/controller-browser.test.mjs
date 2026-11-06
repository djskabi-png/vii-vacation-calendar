import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {readQualityJob} from '../../../app/lib/quality-job-store.ts';

const source='a'.repeat(40),build='11111111-2222-3333-4444-555555555555';
const request=()=>new Request('https://vii.spaplus.co/api/admin/quality',{method:'POST'});
const body={action:'enqueue-browser',idempotencyKey:'browser-controller-1234',profileId:'spa-mobile-world-shell',sourceVersion:'forged-source',origin:'https://untrusted.invalid'};
function enabled(f,changes={}){return {...f.env,BROWSER_ENABLED:'true',EXPECTED_SOURCE_VERSION:source,EXPECTED_BROWSER_SOURCE_VERSION:source,EXPECTED_BUILD_ID:build,PUBLIC_ORIGIN:'https://vii.spaplus.co',QUALITY_BROWSER:{async fetch(url,input){const job=JSON.parse(input.body);assert.equal(url,'https://vii-quality-browser.internal/run');assert.equal(input.headers.Cookie,undefined);assert.equal(input.headers.Authorization,undefined);return Response.json({...job,status:'passed',requestCount:4,steps:3,durationMs:12,...changes});}}};}

test('controller preserves an over-budget failure and actual request count in the durable receipt',async()=>{
 const f=fixture();try{
  const env=enabled(f,{status:'failed',reason:'request_budget_exceeded',requestCount:181,failureStep:'map-ready'});
  const admitted=await(await f.controller.handle(request(),env,'trusted-admin',body)).json();
  await f.controller.consume(env,f.messages[0]);
  const saved=await readQualityJob(f.db,admitted.job.runId);
  assert.equal(saved.status,'completed');assert.equal(saved.receipts.length,1);assert.equal(saved.receipts[0].status,'failed');assert.equal(saved.receipts[0].observed,'request_budget_exceeded; request_count=181');assert.equal(saved.receipts[0].failureStep,'map-ready');
 }finally{f.sqlite.close();}
});

test('private controller admits one browser job, dispatches it and uses only the browser executor',async()=>{
 const f=fixture();let calls=0;try{
  const env=enabled(f,{status:'failed',reason:'write_request_attempted',failureStep:'world-heading',attemptedWrites:[{method:'POST',origin:'https://vii.spaplus.co',path:'<redacted>'}]});const original=env.QUALITY_BROWSER.fetch;env.QUALITY_BROWSER.fetch=async(...args)=>{calls++;return original(...args);};
  for(let i=0;i<2;i++){const response=await f.controller.handle(request(),env,'trusted-admin',body);assert.equal(response.status,202);const payload=await response.json();assert.equal(payload.job.executionKind,'browser');assert.equal(payload.job.sourceVersion,source);assert.equal(payload.job.buildId,build);}
  assert.equal(f.messages.length,1);assert.equal(calls,0);const message=f.messages[0];const saved=await readQualityJob(f.db,message.runId);assert.equal(saved.actor,'trusted-admin');assert.equal(saved.checks[0].configuration.origin,'https://vii.spaplus.co');
  await f.controller.consume(env,message);await f.controller.consume(env,message);
  const completed=await readQualityJob(f.db,message.runId);assert.equal(completed.status,'completed');assert.equal(completed.receipts[0].status,'failed');assert.equal(completed.receipts[0].durationMs,12);assert.equal(completed.receipts[0].failureStep,'world-heading');assert.deepEqual(completed.receipts[0].attemptedWrites,[{method:'POST',origin:'https://vii.spaplus.co',path:'<redacted>'}]);assert.equal(calls,1);assert.equal(f.executions(),0);
  const metadata=await(await f.controller.handle(new Request('https://vii.spaplus.co/api/admin/quality?engine=browser'),env,'trusted-viewer')).json();assert.equal(metadata.enabled,true);assert.equal(metadata.profiles.length,34);
 }finally{f.sqlite.close();}
});

test('inert browser service cannot admit work and a mismatched response never produces a passing receipt',async()=>{
 const f=fixture();try{
  assert.equal((await f.controller.handle(request(),f.env,'admin',body)).status,503);assert.equal(f.messages.length,0);
  const env=enabled(f,{buildId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'});
  const admitted=await(await f.controller.handle(request(),env,'admin',body)).json();await f.controller.consume(env,f.messages[0]);
  const stopped=await readQualityJob(f.db,admitted.job.runId);assert.equal(stopped.status,'blocked');assert.equal(stopped.receipts.length,0);assert.equal(f.executions(),0);
 }finally{f.sqlite.close();}
});

test('controller-only source changes retain the actual browser source; changing the runner fences queued work',async()=>{
 const f=fixture();let calls=0;try{
  const env=enabled(f);env.EXPECTED_SOURCE_VERSION='b'.repeat(40);
  const original=env.QUALITY_BROWSER.fetch;env.QUALITY_BROWSER.fetch=async(...args)=>{calls++;const input=JSON.parse(args[1].body);assert.equal(input.sourceVersion,source);return original(...args);};
  const first=await(await f.controller.handle(request(),env,'trusted-admin',body)).json();assert.equal(first.job.sourceVersion,source);
  env.EXPECTED_SOURCE_VERSION='c'.repeat(40);
  await f.controller.consume(env,f.messages[0]);assert.equal((await readQualityJob(f.db,first.job.runId)).status,'completed');assert.equal(calls,1);
  const second=await(await f.controller.handle(request(),env,'trusted-admin',{...body,idempotencyKey:'browser-independent-5678',EXPECTED_BROWSER_SOURCE_VERSION:'forged'})).json();assert.equal(second.job.sourceVersion,source);
  env.EXPECTED_BROWSER_SOURCE_VERSION='d'.repeat(40);
  await f.controller.consume(env,f.messages[1]);const stopped=await readQualityJob(f.db,second.job.runId);assert.equal(stopped.status,'blocked');assert.equal(stopped.receipts.length,0);assert.equal(calls,1,'changed runner cannot execute the queued old definition');
 }finally{f.sqlite.close();}
});

test('missing or invalid explicit browser source cannot fall back to the controller source',async()=>{
 const f=fixture();try{
  for(const invalid of [undefined,'','UNACTIVATED_QUALITY_BROWSER','a'.repeat(39),'A'.repeat(40)]){
   const env={...enabled(f),EXPECTED_BROWSER_SOURCE_VERSION:invalid};
   assert.equal((await f.controller.handle(request(),env,'trusted-admin',body)).status,503);
   const metadata=await(await f.controller.handle(new Request('https://vii.spaplus.co/api/admin/quality?engine=browser'),env,'trusted-viewer')).json();assert.equal(metadata.enabled,false);
  }
  assert.equal(f.messages.length,0);assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='quality_jobs'").get().n,0,'invalid generation fails before job schema or admission');
 }finally{f.sqlite.close();}
});
