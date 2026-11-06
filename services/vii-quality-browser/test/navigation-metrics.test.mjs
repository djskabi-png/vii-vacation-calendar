import test from 'node:test';
import assert from 'node:assert/strict';
import { readNavigationMetrics } from '../src/navigation-metrics.ts';

function page(performance) { return { evaluate: callback => { const old=globalThis.performance;globalThis.performance=performance;try{return Promise.resolve(callback())}finally{globalThis.performance=old}} }; }
const navigation={startTime:100,responseStart:145.4,responseEnd:800.2,domInteractive:420.7,domContentLoadedEventEnd:500.8};

test('executes the read-only browser callback and returns relative integer timings',async()=>{
  const result=await readNavigationMetrics(page({getEntriesByType(type){return type==='navigation'?[navigation]:[{name:'first-contentful-paint',startTime:250.6},{name:'opaque-entry',startTime:999}]}}));
  assert.deepEqual(result,{ttfbMs:45,responseEndMs:700,domInteractiveMs:321,domContentLoadedMs:401,fcpMs:151});
});
test('missing navigation or paint stage stays unobserved, never fabricated as zero',async()=>{
  assert.equal(await readNavigationMetrics(page({getEntriesByType:type=>type==='navigation'?[]:[]})),undefined);
  const result=await readNavigationMetrics(page({getEntriesByType:type=>type==='navigation'?[{...navigation}]:[]}));
  assert.deepEqual(result,{ttfbMs:45,responseEndMs:700,domInteractiveMs:321,domContentLoadedMs:401,fcpMs:null});
  const unobserved=await readNavigationMetrics(page({getEntriesByType:type=>type==='navigation'?[{...navigation,domInteractive:0,domContentLoadedEventEnd:undefined}]:[]}));
  assert.equal(unobserved.domInteractiveMs,null);assert.equal(unobserved.domContentLoadedMs,null);
  assert.equal(await readNavigationMetrics({evaluate:()=>Promise.reject(new Error('unsupported-browser-api'))}),undefined);
});
test('negative and non-finite provider timing values are rejected',async()=>{
  const result=await readNavigationMetrics(page({getEntriesByType:type=>type==='navigation'?[{...navigation,responseStart:-1}]:[]}));
  assert.equal(result,undefined);
  const nonfinite=await readNavigationMetrics(page({getEntriesByType:type=>type==='navigation'?[{...navigation,responseEnd:Number.NaN}]:[]}));
  assert.equal(nonfinite,undefined);
});
