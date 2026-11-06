import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {executeQualityCheck,selectManualQualityChecks,persistQualityJobProgress} from '../app/lib/quality-platform.ts';
import {enqueueQualityJob,readQualityJob,payloadHash,dueQualityJobIds} from '../app/lib/quality-job-store.ts';
import {runQualityJobSlice} from '../app/lib/quality-job-runner.ts';
import {schedulerJobIntentKey} from '../services/vii-quality-control/src/scheduler.ts';
import {qualityScopeMetadata} from '../app/lib/quality-check-scope.ts';
import {homeDealDates}from'../app/lib/home-deal-dates.ts';

function fixture(){const sqlite=new DatabaseSync(':memory:');const db={prepare(sql){let args=[];const statement={bind(...values){args=values;return statement;},async run(){return{meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return{results:sqlite.prepare(sql).all(...args)};}};return statement;},async batch(statements){return Promise.all(statements.map(statement=>statement.run()));}};return{sqlite,db};}
function platform(build='fixture-build'){
 const source=readFileSync(new URL('../app/lib/quality-job-platform.ts',import.meta.url),'utf8');
 const js=stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm,''),{mode:'strip'}).replace(/^export /gm,'');
 const deps={qualityScopeMetadata,executeQualityCheck,selectManualQualityChecks,persistQualityJobProgress,enqueueQualityJob,readQualityJob,payloadHash,dueQualityJobIds,runQualityJobSlice,__VII_CACHE_BUILD_ID__:build};
 return new Function(...Object.keys(deps),`${js};return {createManualQualityJob,createScheduledQualityJob,consumeQualityJob};`)(...Object.values(deps));
}

test('actual scheduled executor preserves snapshot expiry in its original durable CAS receipt',async()=>{
 const f=fixture(),p=platform();try{
  const {job}=await p.createScheduledQualityJob(f.db,{actor:'scheduler',idempotencyKey:'snapshot-expiry-1234',origin:'https://qa.example.test',checkId:'discovery.vacation.tomorrow.ready'});
  let fetches=0;
  const result=await p.consumeQualityJob(f.db,job.runId,{fetcher:async()=>{fetches++;return Response.json({period:'tomorrow',dates:homeDealDates('tomorrow'),availabilityStatus:'verified',cache:{checkedAt:new Date().toISOString()},deals:[]});}});
  assert.equal(result.status,'completed');
  const saved=await readQualityJob(f.db,job.runId),receipt=saved.receipts[0];
  assert.equal(receipt.status,'passed');assert.ok(Date.parse(receipt.evidenceValidUntil)>Date.parse(receipt.checkedAt));
  const original=f.sqlite.prepare('SELECT receipts_json AS value FROM quality_jobs WHERE run_id=?').get(job.runId).value;
  await p.consumeQualityJob(f.db,job.runId,{fetcher:async()=>{throw Error('completed receipt cannot be replaced');}});
  assert.equal(fetches,1);assert.equal(f.sqlite.prepare('SELECT receipts_json AS value FROM quality_jobs WHERE run_id=?').get(job.runId).value,original);
 }finally{f.sqlite.close();}
});
test('actual platform persists selected immutable scope, executes read-only checks and updates the existing run history',async()=>{
 const f=fixture();const p=platform();const requested=[];
 try{
  const {job}=await p.createManualQualityJob(f.db,{actor:'admin@example.test',idempotencyKey:'integration-key-1234',origin:'https://qa.example.test',level:'full',scope:{changedBoxes:[],consumers:['content.guides']}});
  assert.equal(job.checks.length,1);assert.equal(job.sourceVersion,'fixture-build');
  assert.deepEqual(job.checks[0].configuration.scope.boxIds,['content']);
  assert.deepEqual(job.checks[0].configuration.scope.requirementIds,['V14']);
  assert.equal(f.sqlite.prepare('SELECT status FROM quality_runs WHERE id=?').get(job.runId).status,'running');
  const result=await p.consumeQualityJob(f.db,job.runId,{fetcher:async(url,init)=>{requested.push({url,init});return new Response(`<html><main class="results-list">${'content '.repeat(500)}</main></html>`,{headers:{'content-type':'text/html'}});}});
  assert.equal(result.status,'completed');assert.equal(requested.length,job.checks.length);assert.ok(requested.every(request=>request.init.method==='GET'));
  const row=f.sqlite.prepare('SELECT status,passed_count AS passed,trigger_kind AS kind FROM quality_runs WHERE id=?').get(job.runId);assert.equal(row.status,'passed');assert.equal(row.passed,job.checks.length);assert.equal(row.kind,'manual_full');
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM quality_results WHERE run_id=?').get(job.runId).n,job.checks.length);
 }finally{f.sqlite.close();}
});
test('new source refuses a queued old build and projects blocked rather than passing',async()=>{
 const f=fixture();try{
  const {job}=await platform('old-build').createManualQualityJob(f.db,{actor:'admin@example.test',idempotencyKey:'integration-key-5678',origin:'https://qa.example.test',level:'full',scope:{changedBoxes:[],consumers:['content.guides']}});
  let calls=0;const result=await platform('new-build').consumeQualityJob(f.db,job.runId,{fetcher:async()=>{calls++;throw Error('must not call');}});
  assert.equal(result.status,'blocked');assert.equal(calls,0);assert.equal(f.sqlite.prepare('SELECT status FROM quality_runs WHERE id=?').get(job.runId).status,'blocked');
 }finally{f.sqlite.close();}
});

test('actual scheduled job creation accepts every registry identity and retains the scheduled history kind',async()=>{
 const ids=selectManualQualityChecks('full').map(c=>c.checkId),keys=ids.map(id=>schedulerJobIntentKey(id,123));assert.equal(new Set(keys).size,ids.length);assert.ok(keys.every(key=>/^[A-Za-z0-9:_-]{8,120}$/.test(key)));assert.throws(()=>schedulerJobIntentKey('ambiguous_under.score',123),/invalid_scheduler_intent/);
 const f=fixture();try{const p=platform();const input={actor:'cloudflare-scheduler',idempotencyKey:schedulerJobIntentKey('content.guides',123),origin:'https://qa.example.test',checkId:'content.guides'};const queued=await p.createScheduledQualityJob(f.db,input);assert.equal((await p.createScheduledQualityJob(f.db,input)).duplicate,true);assert.equal(queued.job.checks.length,1);assert.equal(queued.job.checks[0].configuration.trigger,'scheduled');assert.equal(f.sqlite.prepare('SELECT trigger_kind AS kind FROM quality_runs').get().kind,'scheduled');const outcome=await p.consumeQualityJob(f.db,queued.job.runId,{fetcher:async()=>new Response(`<html><main class="results-list">${'content '.repeat(500)}</main></html>`,{headers:{'content-type':'text/html'}})});assert.equal(outcome.status,'completed');}finally{f.sqlite.close();}
});
test('one controller code generation targets independent app builds without a rebuild or shared mutable state',async()=>{
 const f=fixture(),p=platform('UNCHANGED_CONTROLLER_CODE');const a='11111111-2222-3333-4444-555555555555',b='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 try{
  const input={actor:'admin@example.test',origin:'https://qa.example.test',level:'full',scope:{changedBoxes:[],consumers:['content.guides']}};
  const [first,second]=await Promise.all([p.createManualQualityJob(f.db,{...input,idempotencyKey:'runtime-target-one-1234'},{targetBuildId:a}),p.createManualQualityJob(f.db,{...input,idempotencyKey:'runtime-target-two-1234'},{targetBuildId:b})]);
  assert.equal(first.job.sourceVersion,a);assert.equal(second.job.sourceVersion,b);
  let calls=0;const blocked=await p.consumeQualityJob(f.db,first.job.runId,{targetBuildId:b,fetcher:async()=>{calls++;throw Error('wrong app target must not execute');}});
  assert.equal(blocked.status,'blocked');assert.equal(calls,0);
  const result=await p.consumeQualityJob(f.db,second.job.runId,{targetBuildId:b,fetcher:async()=>new Response(`<html><main>${'content '.repeat(500)}</main></html>`,{headers:{'content-type':'text/html'}})});
  assert.equal(result.status,'completed');
 }finally{f.sqlite.close();}
});
test('invalid explicit app generation fails before database work, and JSON input cannot select it',async()=>{
 const p=platform('SERVER_COMPILED_APP');let queries=0;const db={prepare(){queries++;throw Error('database must not be reached');}};
 const input={actor:'admin@example.test',idempotencyKey:'target-validation-key',origin:'https://qa.example.test',level:'full'};
 for(const targetBuildId of [undefined,'','UNACTIVATED_QUALITY_CONTROLLER','1'.repeat(40),'HTTPS://OTHER.INVALID']){
  await assert.rejects(p.createManualQualityJob(db,input,{targetBuildId}),/quality_target_build_invalid/);
  await assert.rejects(p.consumeQualityJob(db,'run-identifier',{targetBuildId}),/quality_target_build_invalid/);
 }
 assert.equal(queries,0);
 const f=fixture();try{const queued=await p.createManualQualityJob(f.db,{...input,targetBuildId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',scope:{changedBoxes:[],consumers:['content.guides']}});assert.equal(queued.job.sourceVersion,'SERVER_COMPILED_APP');}finally{f.sqlite.close();}
});
