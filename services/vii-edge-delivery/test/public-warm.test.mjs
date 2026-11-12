import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import {warmPublicDocuments,publicWarmRoutes,publicWarmRequests} from '../src/public-warm.ts';
import {computeRscCacheBustingSearchParam} from '../../../node_modules/.pnpm/vinext@0.0.50_@vitejs+plugi_67aa13a041cb340aa114f5f24aa08bf9/node_modules/vinext/dist/server/app-rsc-cache-busting.js';

test('RSC warm hashes match the official Vinext algorithm',async()=>{
  for(const target of publicWarmRequests.filter(r=>r.path.includes('.rsc'))){const url=new URL(target.path,'https://vii.spaplus.co');const expected=await computeRscCacheBustingSearchParam(new Headers(target.headers));assert.equal(url.searchParams.get('_rsc'),expected,target.path);}
});

test('release warming inventory remains anonymous, document-only and explicit',async()=>{
  assert.ok(publicWarmRequests.length>publicWarmRoutes.length);
  assert.ok(publicWarmRequests.every(target=>!/^\/(api|booking|admin|account)/.test(new URL(target.path,'https://vii.spaplus.co').pathname)));
  assert.ok(publicWarmRequests.every(target=>target.headers.Accept==='text/html'||target.headers.Accept==='text/x-component'));
});

test('pending build admission never starts scheduled warming',async()=>{
  const old=globalThis.fetch;let reads=0,queued=0;globalThis.fetch=async()=>{reads++;throw Error('unexpected');};
  try{await worker.scheduled({scheduledTime:Date.now()},{EXPECTED_BUILD:'pending-next-release'},{waitUntil(){queued++;}});assert.equal(reads,0);assert.equal(queued,0);}finally{globalThis.fetch=old;}
});

test('one failed document cannot stop other routes and owned background work is drained with at most two active documents',async()=>{
  let active=0,maxActive=0,background=0;const paths=[];
  const result=await warmPublicDocuments(async(request,ctx)=>{
    const path=new URL(request.url).pathname;paths.push(path);active++;maxActive=Math.max(maxActive,active);
    ctx.waitUntil(Promise.resolve().then(()=>{active--;background++;}));
    if(path==='/events')throw Error('transient');
    return new Response('ok',{headers:{'X-VII-Edge-Delivery':'MISS'}});
  },{waitUntil(){}});
  assert.equal(result.attempted,publicWarmRequests.length);assert.equal(result.completed,publicWarmRequests.length-1);assert.equal(result.failed,1);
  assert.equal(background,publicWarmRequests.length);assert.equal(maxActive,2);assert.deepEqual(paths,publicWarmRequests.map(r=>new URL(r.path,'https://vii.spaplus.co').pathname));
});

test('a successful HTTP response rejected by cache admission is not counted as warm',async()=>{
 const result=await warmPublicDocuments(async()=>new Response('old build',{headers:{'X-VII-Edge-Cache-Skip':'build_mismatch'}}),{waitUntil(){}});
 assert.equal(result.attempted,publicWarmRequests.length);assert.equal(result.completed,0);assert.equal(result.failed,publicWarmRequests.length);
});

test('budget exhaustion cannot leave the same regional tail behind every cycle',async()=>{
 const oldNow=Date.now;let now=0;Date.now=()=>now;
 const first=[],second=[];
 const read=paths=>async request=>{paths.push(new URL(request.url).pathname+new URL(request.url).search);now+=2500;return new Response('ok',{headers:{'X-VII-Edge-Delivery':'MISS'}});};
 try{
  const a=await warmPublicDocuments(read(first),{waitUntil(){}},0);
  assert.ok(a.skipped>0);assert.ok(a.attempted<publicWarmRequests.length);assert.equal(a.elapsedMs,90000);
  now=0;const b=await warmPublicDocuments(read(second),{waitUntil(){}},120000);
  assert.equal(second[0],publicWarmRequests[Math.ceil(publicWarmRequests.length/2)].path);
  assert.equal(new Set([...first,...second]).size,publicWarmRequests.length);
  assert.ok(second.includes(publicWarmRequests.at(-1).path));assert.equal(b.elapsedMs,90000);
 }finally{Date.now=oldNow;}
});

test('warming aborts each stalled read and never exceeds its total90second budget',async()=>{
  const oldNow=Date.now,oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;
  let now=0,id=0,active=0,maxActive=0;const timers=new Map(),budgets=[];
  Date.now=()=>now;globalThis.setTimeout=(fn,ms)=>{budgets.push(ms);timers.set(++id,{fn,due:now+ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);
  const flush=()=>new Promise(resolve=>oldSet(resolve,0));
  try{
    const pending=warmPublicDocuments(request=>new Promise((_resolve,reject)=>{active++;maxActive=Math.max(maxActive,active);request.signal.addEventListener('abort',()=>{active--;reject(request.signal.reason);},{once:true});}),{waitUntil(){}});
    for(const step of Array(9).fill(10_000)){now+=step;for(const [id,timer]of [...timers])if(timer.due<=now){timers.delete(id);timer.fn();}await flush();}
    const result=await pending;assert.equal(result.attempted,18);assert.equal(result.elapsedMs,90_000);assert.equal(result.failed,18);
    assert.ok(budgets.every(ms=>ms<=10_000));assert.equal(active,0);assert.equal(maxActive,2);assert.equal(timers.size,0);
  }finally{Date.now=oldNow;globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});
