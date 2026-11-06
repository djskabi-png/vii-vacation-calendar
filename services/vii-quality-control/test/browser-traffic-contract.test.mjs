import test from 'node:test';import assert from 'node:assert/strict';
import{normalizeBrowserTraffic,normalizeBrowserNavigationMetrics,browserObservedResult}from'../src/browser-traffic-contract.ts';
const good={resourceCounts:{document:1,script:1,stylesheet:0,image:1,font:0,fetch:1,other:0},deniedCounts:{external:1,budget:0,write:1,admin:0,invalid:0},writeKinds:['cloudflare_challenge']};
test('bounded traffic counters and fixed classifications survive as a safe durable observation',()=>{
 const normalized=normalizeBrowserTraffic(good,4);assert.deepEqual(normalized,good);assert.notEqual(normalized,good);assert.notEqual(normalized.resourceCounts,good.resourceCounts);
 const observed=browserObservedResult({reason:'write_request_attempted',requestCount:4,traffic:good});assert.match(observed,/write_kinds=cloudflare_challenge/);assert.match(observed,/requests=4/);assert.ok(observed.length<4000);
 assert.equal(browserObservedResult({reason:'request_budget_exceeded',requestCount:181}),'request_budget_exceeded; request_count=181');
});
test('navigation timings preserve null observations and reject opaque or impossible metadata',()=>{
 const metrics={ttfbMs:321,responseEndMs:800,domInteractiveMs:900,domContentLoadedMs:null,fcpMs:750};
 assert.deepEqual(normalizeBrowserNavigationMetrics(metrics),metrics);assert.match(browserObservedResult({requestCount:4,navigationMetrics:metrics}),/navigation_ms=/);
 for(const value of [{...metrics,url:'private-test-sentinel'},{...metrics,ttfbMs:-1},{...metrics,fcpMs:1.5},{...metrics,responseEndMs:180001},{ttfbMs:1},{ttfbMs:null,responseEndMs:null,domInteractiveMs:null,domContentLoadedMs:null,fcpMs:null}])assert.throws(()=>normalizeBrowserNavigationMetrics(value),/browser_navigation_metrics_invalid/);
});
test('arbitrary text, excessive counters and inconsistent totals are rejected without retaining private data',()=>{
 const values=[{...good,secret:'private-test-sentinel'},{...good,writeKinds:['/customer/private-test-sentinel']},{...good,writeKinds:['cloudflare_challenge','cloudflare_challenge']},{...good,resourceCounts:{...good.resourceCounts,script:2}},{...good,resourceCounts:{...good.resourceCounts,script:0.5}},{...good,deniedCounts:{...good.deniedCounts,external:4}},{...good,deniedCounts:{...good.deniedCounts,write:0}},{...good,writeKinds:[]}];
 for(const value of values)assert.throws(()=>normalizeBrowserTraffic(value,4),/browser_traffic_invalid/);
 assert.equal(normalizeBrowserTraffic(undefined,4),undefined);
});
