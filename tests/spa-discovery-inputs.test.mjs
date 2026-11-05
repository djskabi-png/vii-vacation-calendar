import test from 'node:test';
import assert from 'node:assert/strict';
import {spaDiscoveryInputs} from '../app/lib/spa-discovery-inputs.ts';

test('accepted catalog and availability start together rather than adding their waits',async()=>{
  const started=[];let catalogReady,availabilityReady;
  const pending=spaDiscoveryInputs(()=>{started.push('catalog');return new Promise(resolve=>catalogReady=resolve);},()=>{started.push('availability');return new Promise(resolve=>availabilityReady=resolve);},1000);
  await Promise.resolve();assert.deepEqual(started,['catalog','availability']);
  availabilityReady({verified:true});catalogReady([{id:158}]);
  const result=await pending;assert.deepEqual(result.sites,[{id:158}]);assert.deepEqual(result.cached,{verified:true});
});

test('availability deadline retains accepted catalog and exposes the same background refresh',async()=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);
  const result=await spaDiscoveryInputs(async()=>[{id:158}],()=>pending,10);
  assert.deepEqual(result.sites,[{id:158}]);assert.equal(result.cached,null);
  assert.ok(result.availabilityMs>=8);finish({verified:true});assert.deepEqual(await result.refresh,{verified:true});
});

test('availability failure cannot replace accepted catalog or invent verified availability',async()=>{
  const result=await spaDiscoveryInputs(async()=>[{id:158}],async()=>{throw Error('provider');},10);
  assert.deepEqual(result.sites,[{id:158}]);assert.equal(result.cached,null);
  await assert.rejects(spaDiscoveryInputs(async()=>{throw Error('catalog');},async()=>({verified:true}),10),/catalog/);
});
