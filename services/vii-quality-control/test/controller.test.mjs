import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';
import { readQualityJob } from '../../../app/lib/quality-job-store.ts';

const request=()=>new Request('https://vii.spaplus.co/api/admin/quality',{method:'POST'});
const body={action:'enqueue',idempotencyKey:'controller-intent-123',level:'full'};

test('HTTP admission persists one job and queues once without executing a check; duplicate intent and delivery remain idempotent',async()=>{
  const f=fixture();try {
    const first=await f.controller.handle(request(),f.env,'admin@example.test',body);assert.equal(first.status,202);const result=await first.json();
    assert.equal(f.executions(),0);assert.equal(f.messages.length,1);assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM quality_jobs').get().n,1);
    const duplicate=await f.controller.handle(request(),f.env,'admin@example.test',body);assert.equal(duplicate.status,202);assert.equal((await duplicate.json()).duplicate,true);assert.equal(f.messages.length,1);
    const message=f.messages[0];await f.controller.consume(f.env,message);assert.equal(f.executions(),1);assert.equal((await readQualityJob(f.db,result.job.runId)).status,'completed');
    assert.deepEqual(await f.controller.consume(f.env,message),{status:'obsolete'});assert.equal(f.executions(),1);
  }finally{f.sqlite.close();}
});

test('disabled runner refuses admission; GET never consumes and intent reconciliation remains actor scoped',async()=>{
  const f=fixture();try {
    f.env.EXECUTION_ENABLED='false';assert.equal((await f.controller.handle(request(),f.env,'admin@example.test',body)).status,503);
    assert.equal(f.messages.length,0);assert.equal(f.executions(),0);
    f.env.EXECUTION_ENABLED='true';await f.controller.handle(request(),f.env,'admin@example.test',body);
    const get=new Request('https://vii.spaplus.co/api/admin/quality?intentKey=controller-intent-123');
    assert.equal((await f.controller.handle(get,f.env,'other@example.test')).status,404);assert.equal((await f.controller.handle(get,f.env,'admin@example.test')).status,200);assert.equal(f.executions(),0);
  }finally{f.sqlite.close();}
});

test('ambiguous transport is reserved before send and recovery cannot resend it',async()=>{
  const f=fixture();let sends=0;try {
    f.env.RELEASE_QUEUE.send=async()=>{sends++;throw Error('unknown acknowledgement');};
    assert.equal((await f.controller.handle(request(),f.env,'admin@example.test',body)).status,202);
    assert.equal(f.sqlite.prepare('SELECT status FROM quality_dispatch_outbox').get().status,'uncertain');
    await f.controller.recover(f.env);await f.controller.handle(request(),f.env,'admin@example.test',body);
    assert.equal(sends,1);assert.equal(f.executions(),0);
  }finally{f.sqlite.close();}
});

test('cancelled jobs and changed build messages execute nothing',async()=>{
  const f=fixture();try {
    const result=await (await f.controller.handle(request(),f.env,'admin@example.test',body)).json();
    await f.controller.consume(f.env,{...f.messages[0],sourceVersion:'wrong-build'});assert.equal(f.executions(),0);
    assert.equal((await f.controller.handle(request(),f.env,'admin@example.test',{action:'cancel-job',jobId:result.job.runId})).status,202);
    await f.controller.consume(f.env,f.messages[0]);assert.equal(f.executions(),0);assert.equal((await readQualityJob(f.db,result.job.runId)).status,'cancelled');
  }finally{f.sqlite.close();}
});
