import test from 'node:test';
import assert from 'node:assert/strict';
import { requestStageTiming } from '../app/lib/request-stage-timing.ts';

test('timings distinguish parallel server work from total latency without serializing requests',async()=>{
  let now=0;const timing=requestStageTiming(()=>now);let finish;
  const pending=timing.measure('catalog_index',()=>new Promise(resolve=>{finish=resolve}));
  const fast=timing.measure('display',async()=>{now=20;return 'display'});
  assert.equal(await fast,'display');now=80;finish('catalog');assert.equal(await pending,'catalog');
  assert.equal(timing.header(),'display;dur=20.0, catalog_index;dur=80.0, request;dur=80.0');
});

test('failed stage is measured and unsafe dynamic names cannot reach the response header',async()=>{
  let now=0;const timing=requestStageTiming(()=>now);
  await assert.rejects(timing.measure('snapshot',async()=>{now=50;throw Error('database unavailable')}));
  assert.equal(timing.header(),'snapshot;dur=50.0, request;dur=50.0');
  await assert.rejects(timing.measure('private\r\nvalue',async()=>1),/invalid_timing_stage/);
  assert.ok(!timing.header().includes('private'));
});
