import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { readBoundedCacheBody, claimPublicCacheCapture,
  claimPublicCacheWrite } from '../worker/public-cache-work.ts';
import { publicCachePolicy, readPublicCache, storePublicCache } from '../worker/public-response-cache.ts';

function context() {
  const jobs=[];
  return {waitUntil(p){jobs.push(p)},async settle(){while(jobs.length) await Promise.all(jobs.splice(0))}};
}
async function policy(label) {
  const request=new Request('https://vii.spaplus.co/spas',{headers:{Accept:'text/html'}});
  return publicCachePolicy(request,new URL(request.url),`bounded-${label}`);
}

test('bounded body returns exact bytes and never drains the full oversized source',async()=>{
  let pulled=0,cancelled=false;
  const source=new ReadableStream({pull(c){pulled++;c.enqueue(new Uint8Array(16));if(pulled===1000)c.close()},cancel(){cancelled=true}});
  assert.equal(await readBoundedCacheBody(source,32),null);
  assert.ok(pulled<10,`drained ${pulled} chunks before limit`);assert.equal(cancelled,true);
  const body=await readBoundedCacheBody(new Response('exact').body,5);
  assert.equal(new TextDecoder().decode(body),'exact');
  assert.equal((await readBoundedCacheBody(null,5)).byteLength,0);
});

test('slow and broken optional cache streams finish within a finite budget',async()=>{
  let cancelled=false;
  const stalled=new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}});
  const start=performance.now();
  assert.equal(await readBoundedCacheBody(stalled,20,20),null);
  assert.ok(performance.now()-start<500);assert.equal(cancelled,true);
  const broken=new ReadableStream({start(c){c.error(new Error('private payload must not be logged'))}});
  assert.equal(await readBoundedCacheBody(broken,20),null);
});

test('cancelling a cache clone does not truncate the visitor response',async()=>{
  const bytes='original photo and content'.repeat(100);
  const original=new Response(bytes);
  assert.equal(await readBoundedCacheBody(original.clone().body,8),null);
  assert.equal(await original.text(),bytes);
});

test('capture and remote-write budgets are independent and releases idempotent',()=>{
  const a=claimPublicCacheCapture(),b=claimPublicCacheCapture();
  const x=claimPublicCacheWrite(),y=claimPublicCacheWrite();
  assert.equal(claimPublicCacheCapture(),null);assert.equal(claimPublicCacheWrite(),null);
  a();a();const c=claimPublicCacheCapture();assert.equal(typeof c,'function');
  b();c();x();y();
});

test('private/no-store and oversized responses are never cached',async()=>{
  for(const control of ['private','public, no-store','private="Set-Cookie"']) {
    const p=await policy(control),ctx=context();
    const response=new Response('must not share',{headers:{'Content-Type':'text/html','Cache-Control':control}});
    assert.equal(storePublicCache(response,p,undefined,ctx),response);
    await ctx.settle();assert.equal(await readPublicCache(p),null);
  }
  const p=await policy('oversized'),ctx=context();
  const response=new Response('x'.repeat(2*1024*1024+1),{headers:{'Content-Type':'text/html'}});
  const output=storePublicCache(response,p,undefined,ctx);
  const original=output.text();await ctx.settle();
  assert.equal(await readPublicCache(p),null);
  assert.equal((await original).length,2*1024*1024+1);
});

test('independent cached responses survive optional remote-write failure',async()=>{
  const p=await policy('ready'),ctx=context();
  const output=storePublicCache(new Response('exact body',{headers:{'Content-Type':'text/html'}}),p,
    {UPLOADS:{put:async()=>{throw new Error('optional failure')}}},ctx);
  assert.equal(await output.text(),'exact body');
  await ctx.settle();
  const first=await readPublicCache(p),second=await readPublicCache(p);
  assert.notEqual(first,second);assert.equal(await first.text(),'exact body');assert.equal(await second.text(),'exact body');
  assert.equal(first.headers.get('X-VII-Cache-Capture'),null);
});

test('only the observed generic public-stream framework default retains existing caching',async()=>{
  const ctx=context(),p=await policy('framework-default');
  const output=storePublicCache(new Response('public HTML',{headers:{'Content-Type':'text/html','Cache-Control':'no-store, must-revalidate'}}),p,undefined,ctx);
  assert.equal(output.headers.get('X-VII-Page-Cache'),'MISS');await output.text();await ctx.settle();
  assert.equal(await (await readPublicCache(p)).text(),'public HTML');
  const request=new Request('https://vii.spaplus.co/api/catalog?world=spa');
  const data=await publicCachePolicy(request,new URL(request.url),'framework-json');
  const privateJson=new Response('{}',{headers:{'Content-Type':'application/json','Cache-Control':'no-store, must-revalidate'}});
  assert.equal(storePublicCache(privateJson,data,undefined,ctx),privateJson);
  assert.equal(await readPublicCache(data),null);
});

test('Worker does not add a request queue or coalescing wait to HTML,Flight or catalog',()=>{
  const worker=readFileSync(new URL('../worker/index.ts',import.meta.url),'utf8');
  assert.match(worker,/if \(cachePolicy && !refreshPublic\)/);
  assert.ok(!worker.includes('claimPublicCacheFill'));
  assert.ok(!worker.includes('await lease.ready'));
  assert.match(worker,/rewriteCanonicalStream/);
});

test('eight simultaneous cache captures admit only two without truncating any visitor body',async()=>{
  const ctx=context(),results=[];
  const policies=await Promise.all(Array.from({length:8},(_,i)=>policy(`burst${i}`)));
  for(const p of policies) results.push(storePublicCache(new Response('same content',{headers:{'Content-Type':'text/html'}}),p,undefined,ctx));
  assert.equal(results.filter(r=>r.headers.get('X-VII-Cache-Capture')==='queued').length,2);
  assert.equal(results.filter(r=>r.headers.get('X-VII-Cache-Capture')==='busy').length,6);
  assert.deepEqual(await Promise.all(results.map(r=>r.text())),Array(8).fill('same content'));
  await ctx.settle();
});

test('hung remote writes stop admitting IO but do not stop subsequent local cache captures',async()=>{
  const unresolved=[];
  for(let i=0;i<4;i++) {
    const p=await policy(`remote-hang${i}`),ctx=context();
    const response=storePublicCache(new Response('available',{headers:{'Content-Type':'text/html'}}),p,{UPLOADS:{put:()=>new Promise(resolve=>unresolved.push(resolve))}},ctx);
    await response.text();
    // Drain capture only; remote writes deliberately stay unresolved.
    await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(await (await readPublicCache(p)).text(),'available');
  }
  assert.equal(unresolved.length,2,'optional IO budget was exceeded');
  unresolved.forEach(resolve=>resolve());
});
