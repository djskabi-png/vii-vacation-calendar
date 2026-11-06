import { DatabaseSync } from 'node:sqlite';
import { createController } from '../src/controller.ts';
import { enqueueQualityJob, readQualityJob, startQualityJobCheck, claimQualityJob, commitQualityJobCheck, finishQualityJobSlice } from '../../../app/lib/quality-job-store.ts';

export function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  const db = { prepare(sql) { let args=[]; const statement={bind(...values){args=values;return statement;}, async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}, async first(){return sqlite.prepare(sql).get(...args)??null;}, async all(){return {results:sqlite.prepare(sql).all(...args)};}}; return statement; }, async batch(statements){return Promise.all(statements.map(s=>s.run()));} };
  let executions=0;const messages=[];
  const platform={async create(db,input){return enqueueQualityJob(db,{actor:input.actor,idempotencyKey:input.idempotencyKey,payload:{level:input.level,scope:input.scope??null},sourceVersion:'test-build',definitionVersion:'definition-1',checks:[{checkId:'test-read',definitionVersion:'v1',configuration:{}}]});},async consume(db,id){ executions++;const now=new Date().toISOString();await claimQualityJob(db,id,{leaseToken:'lease',leaseUntil:new Date(Date.now()+30000).toISOString(),now});await startQualityJobCheck(db,{runId:id,leaseToken:'lease',index:0,now});await commitQualityJobCheck(db,{runId:id,leaseToken:'lease',index:0,receipt:{checkId:'test-read',status:'passed',observed:'ok',checkedAt:now},now});await finishQualityJobSlice(db,{runId:id,leaseToken:'lease',status:'completed',now});return {status:'completed'};}};
  const controller=createController(platform);
  const env={QUALITY_DB:db,RELEASE_QUEUE:{async send(message){messages.push(message);}},MONITOR_QUEUE:{async send(message){messages.push(message);}},EXECUTION_ENABLED:'true'};
  return {sqlite,db,env,controller,messages,executions:()=>executions};
}
