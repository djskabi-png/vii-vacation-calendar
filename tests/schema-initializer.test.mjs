import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeSchemaOnce} from '../app/lib/schema-initializer.ts';

test('parallel and subsequent reads share one schema initialization without caching query data',async()=>{
 const binding={};let calls=0,release;
 const work=()=>{calls++;return new Promise(resolve=>{release=resolve})};
 const a=initializeSchemaOnce(binding,'v1',work),b=initializeSchemaOnce(binding,'v1',work);
 assert.equal(a,b);await Promise.resolve();assert.equal(calls,1);release();await Promise.all([a,b]);
 await initializeSchemaOnce(binding,'v1',work);assert.equal(calls,1);
});

test('a failed initialization is evicted and another request can recover',async()=>{
 const binding={};let calls=0;
 await assert.rejects(initializeSchemaOnce(binding,'v1',async()=>{calls++;throw Error('database temporarily unavailable')}));
 await initializeSchemaOnce(binding,'v1',async()=>{calls++});assert.equal(calls,2);
});

test('new binding and additive schema version each initialize independently',async()=>{
 const one={},two={};let calls=0;const work=async()=>{calls++};
 await initializeSchemaOnce(one,'v1',work);await initializeSchemaOnce(two,'v1',work);await initializeSchemaOnce(one,'v2',work);
 assert.equal(calls,3);
});
