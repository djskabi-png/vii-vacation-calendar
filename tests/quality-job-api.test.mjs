import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

function handler(extra={}) {
 const pending=[],created=[];
 const job={runId:'quality-job-1234',status:'queued',checks:[{checkId:'fixture',configuration:{privateDefinition:'not transferred'}}],receipts:[],nextIndex:0,sourceVersion:'fixture-build',actor:'verified-admin@example.test'};
 const deps={authorizedAdminSession:async()=>({email:'verified-admin@example.test'}),requiredRuntimeDatabase:async()=>({}),
  getRequestExecutionContext:()=>({waitUntil:p=>pending.push(p)}),createManualQualityJob:async(_db,input)=>{created.push(input);return{job,duplicate:false};},consumeQualityJob:()=>new Promise(()=>{}),
  ensureQualityJobSchema:async()=>{},readQualityJob:async()=>job,requestQualityJobCancel:async()=>{},persistQualityJobProgress:async()=>{},...extra};
 const source=readFileSync(new URL('../app/api/admin/quality/route.ts',import.meta.url),'utf8');
 const js=stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm,''),{mode:'strip'}).replace(/^export /gm,'');
 const result=new Function(...Object.keys(deps),`${js};return {GET,POST};`)(...Object.values(deps));
 return{...result,pending,created};
}
const request=(body,origin='https://qa.example.test')=>new Request('https://qa.example.test/api/admin/quality',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});

test('enqueue returns202 without awaiting a background check, takes actor and origin only from trusted session/request',async()=>{
 const h=handler();const response=await h.POST(request({action:'enqueue',idempotencyKey:'quality-key-1234',level:'regular',actor:'forged',sourceVersion:'forged',origin:'https://evil.test'}));
 assert.equal(response.status,202);assert.equal(h.pending.length,1);assert.equal(h.created[0].actor,'verified-admin@example.test');assert.equal(h.created[0].origin,'https://qa.example.test');assert.equal(h.created[0].sourceVersion,undefined);assert.equal(response.headers.get('cache-control'),'private, no-store');const result=(await response.json()).job;assert.equal(result.runId,'quality-job-1234');assert.equal(result.checks,undefined);assert.equal(result.actor,undefined);assert.equal(result.totalChecks,1);
});
test('job actions preserve auth, same-origin, key and strict scope validation',async()=>{
 assert.equal((await handler({authorizedAdminSession:async()=>null}).POST(request({action:'enqueue'}))).status,403);
 assert.equal((await handler().POST(request({action:'enqueue'},'https://evil.test'))).status,403);
 assert.equal((await handler().POST(request({action:'enqueue',idempotencyKey:'bad'}))).status,400);
 assert.equal((await handler().POST(request({action:'enqueue',idempotencyKey:'quality-key-1234',scope:{changedBoxes:['search']}}))).status,202);
 assert.equal((await handler().POST(request({action:'enqueue',idempotencyKey:'quality-key-1234',scope:{changedBoxes:['']}}))).status,400);
 const unavailable=handler({getRequestExecutionContext:()=>null});assert.equal((await unavailable.POST(request({action:'enqueue',idempotencyKey:'quality-key-1234'}))).status,503);assert.equal(unavailable.created.length,0);
 const conflict=handler({createManualQualityJob:async()=>{throw Error('quality_job_idempotency_conflict');}});assert.equal((await conflict.POST(request({action:'enqueue',idempotencyKey:'quality-key-1234'}))).status,409);
});
test('status reads do not consume jobs and cancellation is an explicit authenticated mutation',async()=>{
 let cancelled=0,consumed=0;const h=handler({consumeQualityJob:async()=>{consumed++;},requestQualityJobCancel:async()=>{cancelled++;}});
 const response=await h.GET(new Request('https://qa.example.test/api/admin/quality?jobId=quality-job-1234'));assert.equal(response.status,200);assert.equal(consumed,0);assert.equal(h.pending.length,0);
 assert.equal((await h.POST(request({action:'cancel-job',jobId:'quality-job-1234'}))).status,202);assert.equal(cancelled,1);assert.equal(consumed,0);
 assert.equal((await h.GET(new Request('https://qa.example.test/api/admin/quality?jobId=bad!'))).status,400);
});
