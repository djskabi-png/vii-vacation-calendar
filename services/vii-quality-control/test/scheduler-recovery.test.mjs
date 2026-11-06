import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {ensureSchedulerSchema,admitScheduledChecks,schedulerJobIntentKey} from '../src/scheduler.ts';
import {readSchedulerAttention,reconcileSchedulerAdmission} from '../src/scheduler-recovery.ts';
import {enqueueQualityJob,readQualityJob} from '../../../app/lib/quality-job-store.ts';
import {qualityRegistry} from '../../../app/lib/quality-platform.ts';
import {ensureControlAuxiliarySchema} from '../src/control-schema.ts';
const check=qualityRegistry[0],bucket=2;
async function unknown(f){await ensureSchedulerSchema(f.db);f.sqlite.prepare("INSERT INTO quality_scheduler_admissions VALUES(?,?,?,'unknown',?,NULL)").run(check.checkId,bucket,'generation',600000);}
async function scheduledJob(f,createdAt='2026-01-01T00:00:00.000Z') {return (await enqueueQualityJob(f.db,{actor:'cloudflare-scheduler',idempotencyKey:schedulerJobIntentKey(check.checkId,bucket),payload:null,sourceVersion:'test-build',definitionVersion:'definition',checks:[{checkId:check.checkId,definitionVersion:'v1',configuration:{trigger:'scheduled',check,level:'regular',origin:'https://fixture.invalid'}}],now:createdAt})).job;}

test('an operator can reconcile and release unknown admission without deleting its history or sending anything',async()=>{
 const f=fixture();try{await unknown(f);assert.equal((await readSchedulerAttention(f.db)).attention.length,1);assert.equal((await reconcileSchedulerAdmission(f.db,{actor:'admin',checkId:check.checkId,bucket,mode:'inspect'})).status,'unknown');
 for(let i=0;i<2;i++)assert.equal((await reconcileSchedulerAdmission(f.db,{actor:'admin',checkId:check.checkId,bucket,mode:'allow-next'})).status,'operator-cleared');
 assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM quality_scheduler_reconciliation_audit').get().n,1);assert.equal((await readSchedulerAttention(f.db)).attention.length,0);assert.equal(f.messages.length,0);
 const only=qualityRegistry.filter(c=>c.checkId!==check.checkId).map(c=>({checkId:c.checkId,status:'running'}));const next=await admitScheduledChecks(f.db,{now:3600000,generation:'next',enabled:true,existing:only,createScheduledJob:async()=> 'new-deliberate-job'});assert.equal(next.length,1);assert.equal(next[0].checkId,check.checkId);
 }finally{f.sqlite.close();}
});
test('inspection links the original durable job and recovery uses the monitor queue without a duplicate create',async()=>{
 const f=fixture();try{await unknown(f);const job=await scheduledJob(f);assert.equal((await reconcileSchedulerAdmission(f.db,{actor:'admin',checkId:check.checkId,bucket,mode:'inspect'})).runId,job.runId);await f.controller.recover(f.env);assert.equal(f.messages.length,1);assert.equal(f.messages[0].priority,'monitor');assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM quality_jobs').get().n,1);assert.equal(f.executions(),0);}finally{f.sqlite.close();}
});
test('an active original job cannot be cleared into another scheduled run',async()=>{
 const f=fixture();try{await unknown(f);await scheduledJob(f);await assert.rejects(reconcileSchedulerAdmission(f.db,{actor:'admin',checkId:check.checkId,bucket,mode:'allow-next'}),/scheduler_job_still_active/);assert.equal((await readSchedulerAttention(f.db)).attention.length,1);assert.equal(f.messages.length,0);}finally{f.sqlite.close();}
});
test('a job appearing after deliberate release is fenced before a late Queue send',async()=>{
 const f=fixture();try{await unknown(f);await reconcileSchedulerAdmission(f.db,{actor:'admin',checkId:check.checkId,bucket,mode:'allow-next'});const late=await scheduledJob(f);await f.controller.dispatch(f.env,late,'monitor');assert.equal(f.messages.length,0);assert.equal((await readQualityJob(f.db,late.runId)).reason,'scheduled_admission_superseded');assert.equal(f.executions(),0);}finally{f.sqlite.close();}
});
test('unknown scheduled dispatch stays visible, can be explicitly released, and a late delivery executes nothing',async()=>{
 const f=fixture();try{await unknown(f);const job=await scheduledJob(f);await reconcileSchedulerAdmission(f.db,{actor:'admin',checkId:check.checkId,bucket,mode:'inspect'});f.env.MONITOR_QUEUE.send=async()=>{throw Error('unknown send')};await f.controller.dispatch(f.env,job,'monitor');assert.equal((await readSchedulerAttention(f.db)).attention.length,1);assert.equal((await readQualityJob(f.db,job.runId)).status,'blocked');await reconcileSchedulerAdmission(f.db,{actor:'admin',checkId:check.checkId,bucket,mode:'allow-next'});await f.controller.consume(f.env,{version:1,runId:job.runId,expectedIndex:0,sourceVersion:job.sourceVersion,priority:'monitor'});assert.equal(f.executions(),0);}finally{f.sqlite.close();}
});
test('repeated operator release preserves the first actor and requires matching durable audit evidence',async()=>{
 const f=fixture();try{await unknown(f);const first=await reconcileSchedulerAdmission(f.db,{actor:'first-admin',checkId:check.checkId,bucket,mode:'allow-next'});const repeated=await reconcileSchedulerAdmission(f.db,{actor:'second-admin',checkId:check.checkId,bucket,mode:'allow-next'});assert.equal(first.appliedBy,'first-admin');assert.equal(repeated.appliedBy,'first-admin');assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM quality_scheduler_reconciliation_audit').get().n,1);f.sqlite.prepare("UPDATE quality_scheduler_reconciliation_audit SET action='different-action'").run();await assert.rejects(reconcileSchedulerAdmission(f.db,{actor:'second-admin',checkId:check.checkId,bucket,mode:'allow-next'}),/scheduler_reconciliation_unverified/);}finally{f.sqlite.close();}
});
test('an uncommitted/no-op batch cannot be reported as a cleared admission',async()=>{
 const f=fixture();try{await unknown(f);await ensureControlAuxiliarySchema(f.db);f.db.batch=async()=>[];await assert.rejects(reconcileSchedulerAdmission(f.db,{actor:'admin',checkId:check.checkId,bucket,mode:'allow-next'}),/scheduler_reconciliation_unverified/);assert.equal((await readSchedulerAttention(f.db)).attention.length,1);}finally{f.sqlite.close();}
});

test('inspection reports a concurrent operator decision instead of an uncommitted link',async()=>{
 const f=fixture();try{
 await unknown(f);await scheduledJob(f);await ensureControlAuxiliarySchema(f.db);
 const prepare=f.db.prepare.bind(f.db);let raced=false;
 f.db.prepare=sql=>{const statement=prepare(sql);if(sql.startsWith("UPDATE quality_scheduler_admissions SET status='linked'")){const run=statement.run.bind(statement);statement.run=async()=>{if(!raced){raced=true;f.sqlite.prepare("INSERT INTO quality_scheduler_reconciliation_audit VALUES(?,?,?,?,?,?,?)").run(`allow-next:${check.checkId}:${bucket}`,check.checkId,bucket,'other-admin','allow-next',null,600001);f.sqlite.prepare("UPDATE quality_scheduler_admissions SET status='operator-cleared' WHERE check_id=? AND bucket=?").run(check.checkId,bucket);}return run();};}return statement;};
 const state=await reconcileSchedulerAdmission(f.db,{actor:'inspector',checkId:check.checkId,bucket,mode:'inspect'});
 assert.equal(raced,true);assert.equal(state.status,'operator-cleared');assert.equal(state.appliedBy,'other-admin');assert.equal(f.messages.length,0);
 }finally{f.sqlite.close();}
});
