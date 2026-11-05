import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import {warmPublicDocuments,publicWarmRoutes} from '../src/public-warm.ts';

test('scheduled public documents warm the same HTML variants used by real browsers without warming APIs',async()=>{
  const oldFetch=globalThis.fetch,oldCaches=globalThis.caches,entries=new Map(),requests=[],tasks=[];
  const ctx={waitUntil(p){tasks.push(p);}},env={EXPECTED_BUILD:'warm-build',ORIGIN:'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site'};
  globalThis.caches={default:{async match(key){return entries.get(key.url)?.clone();},async put(key,response){entries.set(key.url,response.clone());}}};
  globalThis.fetch=async request=>{requests.push(request);return new Response('document '+new URL(request.url).pathname,{headers:{'Content-Type':request.url.includes('.rsc')?'text/x-component':'text/html','X-VII-Cache-Build':'warm-build','X-VII-Cache-Until':String(Date.now()+300_000)}});};
  try{
    await worker.scheduled({scheduledTime:Date.now()},env,ctx);await Promise.allSettled(tasks);
    assert.deepEqual(requests.map(r=>new URL(r.url).pathname),[...publicWarmRoutes]);
    assert.ok(requests.every(r=>r.method==='GET'&&!r.headers.has('Cookie')&&!r.headers.has('Authorization')&&!new URL(r.url).search));
    assert.ok(requests.every(r=>!/^\/(api|booking|admin|account)/.test(new URL(r.url).pathname)));
    for(const accept of ['text/html','text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7','text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8']){
      const response=await worker.fetch(new Request('https://vii.spaplus.co/',{headers:{Accept:accept}}),env,ctx);
      assert.equal(response.headers.get('X-VII-Edge-Delivery'),'HIT');assert.equal(await response.text(),'document /');
    }
    assert.equal(requests.length,8);
    await worker.fetch(new Request('https://vii.spaplus.co/',{headers:{Accept:'text/html,application/json'}}),env,ctx);await Promise.allSettled(tasks);
    assert.equal(requests.length,9,'unknown negotiation remains distinct');
    for(const accept of ['text/x-component','text/x-component;q=0.9']){
      await worker.fetch(new Request('https://vii.spaplus.co/.rsc',{headers:{Accept:accept,RSC:'1'}}),env,ctx);await Promise.allSettled(tasks);
    }
    assert.equal(requests.length,11,'RSC Accept variants retain their original identity');
  }finally{globalThis.fetch=oldFetch;globalThis.caches=oldCaches;}
});

test('pending build admission never starts scheduled warming',async()=>{
  const old=globalThis.fetch;let reads=0,queued=0;globalThis.fetch=async()=>{reads++;throw Error('unexpected');};
  try{await worker.scheduled({scheduledTime:Date.now()},{EXPECTED_BUILD:'pending-next-release'},{waitUntil(){queued++;}});assert.equal(reads,0);assert.equal(queued,0);}finally{globalThis.fetch=old;}
});

test('one failed document cannot stop other routes and owned background work is drained sequentially',async()=>{
  let active=0,maxActive=0,background=0;const paths=[];
  const result=await warmPublicDocuments(async(request,ctx)=>{
    const path=new URL(request.url).pathname;paths.push(path);active++;maxActive=Math.max(maxActive,active);
    ctx.waitUntil(Promise.resolve().then(()=>{active--;background++;}));
    if(path==='/events')throw Error('transient');
    return new Response('ok');
  },{waitUntil(){}});
  assert.equal(result.attempted,8);assert.equal(result.completed,7);assert.equal(result.failed,1);
  assert.equal(background,8);assert.equal(maxActive,1);assert.deepEqual(paths,[...publicWarmRoutes]);
});

test('warming aborts each stalled read and never exceeds its total45second budget',async()=>{
  const oldNow=Date.now,oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;
  let now=0,id=0,active=0,maxActive=0;const timers=new Map(),budgets=[];
  Date.now=()=>now;globalThis.setTimeout=(fn,ms)=>{budgets.push(ms);timers.set(++id,{fn,due:now+ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);
  const flush=()=>new Promise(resolve=>oldSet(resolve,0));
  try{
    const pending=warmPublicDocuments(request=>new Promise((_resolve,reject)=>{active++;maxActive=Math.max(maxActive,active);request.signal.addEventListener('abort',()=>{active--;reject(request.signal.reason);},{once:true});}),{waitUntil(){}});
    for(const step of [10_000,10_000,10_000,10_000,5_000]){now+=step;for(const [id,timer]of [...timers])if(timer.due<=now){timers.delete(id);timer.fn();}await flush();}
    const result=await pending;assert.equal(result.attempted,5);assert.equal(result.elapsedMs,45_000);assert.equal(result.failed,5);
    assert.ok(budgets.every(ms=>ms<=10_000));assert.equal(active,0);assert.equal(maxActive,1);assert.equal(timers.size,0);
  }finally{Date.now=oldNow;globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});
