import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {handleQueueDelivery} from '../src/queue-consumer.ts';

test('poison messages are durably classified immediately without unbounded retries',async()=>{
 const f=fixture();let ack=0,retry=0;try{const message={id:'poison-1',attempts:1,body:{unsafe:'not persisted'},ack(){ack++},retry(){retry++}};await handleQueueDelivery(message,f.env,async()=>{throw Error('invalid_queue_message')});assert.equal(ack,1);assert.equal(retry,0);assert.equal(f.sqlite.prepare('SELECT reason FROM quality_queue_failures').get().reason,'invalid_queue_message');assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM quality_queue_failures').get().n,1);}finally{f.sqlite.close();}
});
test('consumer failures retry twice, then expose a blocked job and acknowledge only after durable classification',async()=>{
 const f=fixture();let ack=0,retry=0;try{await f.controller.handle(new Request('https://vii.spaplus.co/api/admin/quality',{method:'POST'}),f.env,'admin@example.test',{action:'enqueue',level:'full',idempotencyKey:'queue-budget-fixture'});const body=f.messages[0];for(let attempts=1;attempts<=3;attempts++){await handleQueueDelivery({id:'retry-message',attempts,body,ack(){ack++},retry(){retry++}},f.env,async()=>{throw Error('simulated unavailable consumer')});}assert.equal(ack,1);assert.equal(retry,2);assert.equal(f.sqlite.prepare('SELECT status,reason FROM quality_jobs').get().status,'blocked');assert.equal(f.sqlite.prepare('SELECT reason FROM quality_queue_failures').get().reason,'queue_attempt_budget_exhausted');}finally{f.sqlite.close();}
});
test('a classification write failure cannot acknowledge or silently discard the delivery',async()=>{
 let ack=0;await assert.rejects(handleQueueDelivery({id:'db-failed',attempts:3,body:null,ack(){ack++},retry(){}},{QUALITY_DB:{prepare(){return{run(){throw Error('db unavailable')}}},batch(){throw Error('db unavailable')}}},async()=>{throw Error('invalid_queue_message')}),/db unavailable/);assert.equal(ack,0);
});
