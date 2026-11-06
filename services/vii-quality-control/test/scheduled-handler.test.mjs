import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {fixture} from './fixture.mjs';
import {admitScheduledChecks,schedulerJobIntentKey,scheduledCheckSelection,schedulerWindowOpen} from '../src/scheduler.ts';
import {ensureControlAuxiliarySchema} from '../src/control-schema.ts';
import {enqueueQualityJob,readQualityJob} from '../../../app/lib/quality-job-store.ts';
import {qualityRegistry,persistQualityJobProgress} from '../../../app/lib/quality-platform.ts';

function actualScheduled(deps){const text=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('index.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let method;function visit(n){if(ts.isMethodDeclaration(n)&&n.name.getText(ast)==='scheduled')method=n.getText(ast);ts.forEachChild(n,visit)}visit(ast);assert.ok(method);const js=ts.transpileModule(`return ({${method}}).scheduled;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function(...Object.keys(deps),js)(...Object.values(deps));}
test('actual Cron handler initializes a fresh DB, admits valid durable jobs and dispatches only after linking their monitor ownership',async()=>{
 const f=fixture();const create=async(db,input)=>{const check=qualityRegistry.find(c=>c.checkId===input.checkId);const queued=await enqueueQualityJob(db,{actor:input.actor,idempotencyKey:input.idempotencyKey,payload:{checkId:input.checkId},sourceVersion:'test-build',definitionVersion:'test-definition',checks:[{checkId:check.checkId,definitionVersion:'test',configuration:{check,trigger:'scheduled',origin:input.origin,level:'regular'}}]});await persistQualityJobProgress(db,queued.job);return queued;};
 const run=actualScheduled({controller:f.controller,admitScheduledChecks,schedulerJobIntentKey,scheduledCheckSelection,schedulerWindowOpen,qualityBuildIdentity:()=> 'test-build',createScheduledQualityJob:create,readQualityJob,ensureControlAuxiliarySchema});
 try{const env={...f.env,PUBLIC_ORIGIN:'https://fixture.invalid',AUTHORITY_ENABLED:'true',SCHEDULE_ENABLED:'true'};await run({},env);assert.equal(f.messages.length,2);assert.ok(f.messages.every(m=>m.priority==='monitor'));assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM quality_scheduler_admissions WHERE status='linked'").get().n,2);assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM quality_scheduler_admissions WHERE status='unknown'").get().n,0);assert.ok(f.sqlite.prepare('SELECT idempotency_key AS key FROM quality_jobs').all().every(row=>/^[A-Za-z0-9:_-]{8,120}$/.test(row.key)));assert.equal(f.executions(),0);await run({},env);assert.equal(f.messages.length,2);await run({}, {...env,AUTHORITY_ENABLED:'false'});assert.equal(f.messages.length,2);}finally{f.sqlite.close();}
});

test('actual Cron canary admits only its selected check and expires before any database work',async()=>{
 const f=fixture();let recovered=0;
 const create=async(db,input)=>{const check=qualityRegistry.find(c=>c.checkId===input.checkId);const queued=await enqueueQualityJob(db,{actor:input.actor,idempotencyKey:input.idempotencyKey,payload:{checkId:input.checkId},sourceVersion:'test-build',definitionVersion:'test-definition',checks:[{checkId:check.checkId,definitionVersion:'test',configuration:{check,trigger:'scheduled',origin:input.origin,level:'regular'}}]});await persistQualityJobProgress(db,queued.job);return queued;};
 const run=actualScheduled({controller:{...f.controller,async recover(env){recovered++;return f.controller.recover(env);}},admitScheduledChecks,schedulerJobIntentKey,scheduledCheckSelection,schedulerWindowOpen,qualityBuildIdentity:()=> 'test-build',createScheduledQualityJob:create,readQualityJob,ensureControlAuxiliarySchema});
 try{
  const env={...f.env,PUBLIC_ORIGIN:'https://vii.spaplus.co',AUTHORITY_ENABLED:'true',SCHEDULE_ENABLED:'true',SCHEDULE_CHECK_IDS:'["global.home.semantic"]',SCHEDULE_UNTIL:new Date(Date.now()-1).toISOString()};
  await run({},env);assert.equal(recovered,0);assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get().n,0);
  env.SCHEDULE_UNTIL=new Date(Date.now()+120000).toISOString();env.SCHEDULE_CHECK_IDS='["missing.check"]';await assert.rejects(run({},env),/invalid_scheduler_selection/);assert.equal(recovered,0);
  env.SCHEDULE_CHECK_IDS='["global.home.semantic"]';await run({},env);assert.equal(f.messages.length,1);assert.equal(f.sqlite.prepare('SELECT check_id FROM quality_scheduler_admissions').get().check_id,'global.home.semantic');await run({},env);assert.equal(f.messages.length,1);
 }finally{f.sqlite.close();}
});

test('experience retention is independently gated and cannot stop quality recovery',async()=>{
 let pruned=0,recovered=0;
 const run=actualScheduled({pruneExperience:async()=>{pruned++;throw Error('retention fixture failure');},controller:{async recover(){recovered++;}},schedulerWindowOpen:()=>true,scheduledCheckSelection:()=>[],admitScheduledChecks:async()=>[],ensureControlAuxiliarySchema:async()=>{},qualityBuildIdentity:()=> 'test-build'});
 const env={EXPERIENCE_ENABLED:'true',AUTHORITY_ENABLED:'false'};
 await run({},env);assert.equal(pruned,1);assert.equal(recovered,0);
 const db={prepare(){return {bind(){return this;},async run(){}};}};
 await run({},{...env,AUTHORITY_ENABLED:'true',EXECUTION_ENABLED:'true',QUALITY_DB:db});assert.equal(pruned,2);assert.equal(recovered,1);
 await run({},{...env,EXPERIENCE_ENABLED:'false'});assert.equal(pruned,2);
});
