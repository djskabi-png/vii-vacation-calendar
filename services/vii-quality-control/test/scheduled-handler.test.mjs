import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {fixture} from './fixture.mjs';
import {admitScheduledChecks,schedulerJobIntentKey} from '../src/scheduler.ts';
import {ensureControlAuxiliarySchema} from '../src/control-schema.ts';
import {enqueueQualityJob,readQualityJob} from '../../../app/lib/quality-job-store.ts';
import {qualityRegistry,persistQualityJobProgress} from '../../../app/lib/quality-platform.ts';

function actualScheduled(deps){const text=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('index.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let method;function visit(n){if(ts.isMethodDeclaration(n)&&n.name.getText(ast)==='scheduled')method=n.getText(ast);ts.forEachChild(n,visit)}visit(ast);assert.ok(method);const js=ts.transpileModule(`return ({${method}}).scheduled;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function(...Object.keys(deps),js)(...Object.values(deps));}
test('actual Cron handler initializes a fresh DB, admits valid durable jobs and dispatches only after linking their monitor ownership',async()=>{
 const f=fixture();const create=async(db,input)=>{const check=qualityRegistry.find(c=>c.checkId===input.checkId);const queued=await enqueueQualityJob(db,{actor:input.actor,idempotencyKey:input.idempotencyKey,payload:{checkId:input.checkId},sourceVersion:'test-build',definitionVersion:'test-definition',checks:[{checkId:check.checkId,definitionVersion:'test',configuration:{check,trigger:'scheduled',origin:input.origin,level:'regular'}}]});await persistQualityJobProgress(db,queued.job);return queued;};
 const run=actualScheduled({controller:f.controller,admitScheduledChecks,schedulerJobIntentKey,qualityBuildIdentity:()=> 'test-build',createScheduledQualityJob:create,readQualityJob,ensureControlAuxiliarySchema});
 try{const env={...f.env,PUBLIC_ORIGIN:'https://fixture.invalid',AUTHORITY_ENABLED:'true',SCHEDULE_ENABLED:'true'};await run({},env);assert.equal(f.messages.length,2);assert.ok(f.messages.every(m=>m.priority==='monitor'));assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM quality_scheduler_admissions WHERE status='linked'").get().n,2);assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM quality_scheduler_admissions WHERE status='unknown'").get().n,0);assert.ok(f.sqlite.prepare('SELECT idempotency_key AS key FROM quality_jobs').all().every(row=>/^[A-Za-z0-9:_-]{8,120}$/.test(row.key)));assert.equal(f.executions(),0);await run({},env);assert.equal(f.messages.length,2);await run({}, {...env,AUTHORITY_ENABLED:'false'});assert.equal(f.messages.length,2);}finally{f.sqlite.close();}
});
