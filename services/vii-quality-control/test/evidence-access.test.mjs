import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {createBrowserQualityJob} from '../src/browser-job-platform.ts';
import {evidenceKey} from '../../vii-quality-browser/src/evidence.ts';
const source='a'.repeat(40),build='11111111-2222-3333-4444-555555555555';
async function completed(f){
 const {job}=await createBrowserQualityJob(f.db,{actor:'smoke-test',idempotencyKey:'evidence-test-original',sourceVersion:source,buildId:build,profileId:'spa-mobile-world-shell',origin:'https://vii.spaplus.co'});
 const key=evidenceKey({sourceVersion:source,jobId:job.runId,device:'mobile',scenario:'world-shell'});
 const receipt={checkId:job.checks[0].checkId,status:'blocked',observed:'observed_build_mismatch',checkedAt:new Date().toISOString(),evidenceUrl:key};
 await f.db.prepare("UPDATE quality_jobs SET status='completed',next_index=1,receipts_json=? WHERE run_id=?").bind(JSON.stringify([receipt]),job.runId).run();
 return{job,key,receipt};
}
const request=id=>new Request('https://vii.spaplus.co/api/admin/quality?evidence=1&jobId='+id);
const jpeg=()=>new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg','Content-Length':'4','Set-Cookie':'must-not-forward=1'}});

test('a verified persisted historical job supplies its own identity while execution is off',async()=>{
 const f=fixture();try{const {job}=await completed(f);let calls=0;
  const env={...f.env,EXECUTION_ENABLED:'false',BROWSER_ENABLED:'false',EXPECTED_SOURCE_VERSION:'b'.repeat(40),QUALITY_BROWSER:{async fetch(url,input){calls++;assert.equal(url.pathname,'/evidence');assert.equal(url.searchParams.get('sourceVersion'),source);assert.equal(url.searchParams.get('device'),'mobile');assert.equal(input.headers['X-VII-Quality-Evidence-Source'],source);return jpeg();}}};
  const response=await f.controller.handle(request(job.runId),env,'authorized-viewer');assert.equal(response.status,200);assert.equal(calls,1);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[255,216,255,217]);
 }finally{f.sqlite.close();}
});

test('unknown, queued, forged definition and cross-job evidence never reach storage',async()=>{
 const f=fixture();try{const {job,receipt}=await completed(f);let calls=0;const env={...f.env,QUALITY_BROWSER:{fetch(){calls++;return Promise.resolve(jpeg());}}};
  assert.equal((await f.controller.handle(request('not-a-known-job'),env,'viewer')).status,404);
  assert.equal((await f.controller.handle(new Request(request(job.runId).url+'&key=external'),env,'viewer')).status,400);
  await f.db.prepare("UPDATE quality_jobs SET status='queued' WHERE run_id=?").bind(job.runId).run();assert.equal((await f.controller.handle(request(job.runId),env,'viewer')).status,409);
  await f.db.prepare("UPDATE quality_jobs SET status='completed',receipts_json=? WHERE run_id=?").bind(JSON.stringify([{...receipt,evidenceUrl:receipt.evidenceUrl.replace(job.runId,'another-job-id')}]),job.runId).run();assert.equal((await f.controller.handle(request(job.runId),env,'viewer')).status,404);
  await f.db.prepare("UPDATE quality_jobs SET receipts_json=?,definition_version='changed' WHERE run_id=?").bind(JSON.stringify([receipt]),job.runId).run();assert.equal((await f.controller.handle(request(job.runId),env,'viewer')).status,404);assert.equal(calls,0);
 }finally{f.sqlite.close();}
});

test('missing or invalid downstream image cannot become an evidence response',async()=>{
 const f=fixture();try{const {job}=await completed(f);
  for(const response of [new Response(null,{status:404}),new Response('evil',{headers:{'Content-Type':'image/jpeg','Content-Length':'4'}})]){const env={...f.env,QUALITY_BROWSER:{async fetch(){return response;}}};const observed=await f.controller.handle(request(job.runId),env,'viewer');assert.equal(observed.status,response.status===404?404:503);assert.match(observed.headers.get('content-type'),/json/);}
 }finally{f.sqlite.close();}
});
