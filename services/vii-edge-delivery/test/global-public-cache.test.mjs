import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import {globalPublicVariant,readGlobalPublicCache,writeGlobalPublicCache} from '../src/global-public-cache.ts';

function bucket(){const data=new Map();return {data,reads:0,writes:0,async get(key){this.reads++;const value=data.get(key);return value?{size:value.byteLength,body:new Response(value.slice()).body}:null;},async put(key,value){this.writes++;data.set(key,value.slice());}};}
function fixture(){
 const priorFetch=globalThis.fetch,priorCaches=globalThis.caches,store=bucket(),tasks=[];let calls=0,build='global-build';
 const env={EXPECTED_BUILD:build,PUBLIC_CACHE:store},ctx={waitUntil(p){tasks.push(p);}};
 globalThis.fetch=async request=>{calls++;return new Response(`public ${new URL(request.url).pathname}`,{headers:{'Content-Type':request.url.includes('.rsc')?'text/x-component':'text/html','X-VII-Cache-Build':build,'X-VII-Cache-Until':String(Date.now()+180_000),'Content-Security-Policy':"default-src 'self'"}});};
 const region=()=>{const map=new Map();globalThis.caches={default:{async match(key){return map.get(key.url)?.clone();},async put(key,value){map.set(key.url,value.clone());}}};};region();
 return {store,env,ctx,region,get calls(){return calls;},build(value){build=value;env.EXPECTED_BUILD=value;},async drain(){while(tasks.length)await Promise.allSettled(tasks.splice(0));},restore(){globalThis.fetch=priorFetch;globalThis.caches=priorCaches;}};
}
const request=(path='/',headers={Accept:'text/html'})=>new Request('https://vii.spaplus.co'+path,{headers});

test('a fresh anonymous document is reused across empty regional caches with exact headers and build',async()=>{
 const f=fixture();try{
  const first=await worker.fetch(request(),f.env,f.ctx);assert.equal(first.headers.get('X-VII-Edge-Delivery'),'MISS');const body=await first.text();await f.drain();assert.equal(f.store.writes,1);
  f.region();const cross=await worker.fetch(request(),f.env,f.ctx);assert.equal(cross.headers.get('X-VII-Edge-Delivery'),'HIT');assert.equal(cross.headers.get('X-VII-Edge-Cache-Backend'),'global-r2');assert.equal(await cross.text(),body);assert.equal(cross.headers.get('Content-Security-Policy'),"default-src 'self'");assert.equal(cross.headers.get('X-VII-Cache-Build'),'global-build');await f.drain();assert.equal(f.calls,1);
  const local=await worker.fetch(request(),f.env,f.ctx);assert.equal(local.headers.get('X-VII-Edge-Cache-Backend'),'available');assert.equal(f.calls,1);
 }finally{f.restore();}
});

test('the global tier serves ordinary RSC but cannot collapse router state or transactional variants',async()=>{
 const f=fixture();try{
  const nav=()=>request('/spas.rsc?_rsc',{Accept:'text/x-component',RSC:'1'});
  await (await worker.fetch(nav(),f.env,f.ctx)).arrayBuffer();await f.drain();f.region();const hit=await worker.fetch(nav(),f.env,f.ctx);assert.equal(hit.headers.get('X-VII-Edge-Cache-Backend'),'global-r2');assert.match(hit.headers.get('Content-Type'),/text\/x-component/);await hit.arrayBuffer();await f.drain();
  for(const [path,headers] of [['/spas.rsc?_rsc=state',{Accept:'text/x-component',RSC:'1','Next-Router-State-Tree':'other'}],['/search?from=2026-11-26',{Accept:'text/html'}],['/admin',{Accept:'text/html'}],['/api/catalog?world=vacations',{Accept:'application/json'}],['/en/events',{Accept:'text/html'}],['/events?guests=6',{Accept:'text/html'}]]){
   const reads=f.store.reads,writes=f.store.writes;await (await worker.fetch(request(path,headers),f.env,f.ctx)).arrayBuffer();await f.drain();assert.equal(f.store.reads,reads,path);assert.equal(f.store.writes,writes,path);
  }
 }finally{f.restore();}
});

test('expired or different-build objects cannot become fresh through promotion',async()=>{
 const f=fixture(),oldNow=Date.now;let clock=oldNow();Date.now=()=>clock;
 try{await (await worker.fetch(request(),f.env,f.ctx)).arrayBuffer();await f.drain();clock+=181_000;f.region();const expired=await worker.fetch(request(),f.env,f.ctx);assert.equal(expired.headers.get('X-VII-Edge-Delivery'),'MISS');await expired.arrayBuffer();await f.drain();assert.equal(f.calls,2);
  f.build('next-build');f.region();const next=await worker.fetch(request(),f.env,f.ctx);assert.equal(next.headers.get('X-VII-Edge-Delivery'),'MISS');assert.equal(next.headers.get('X-VII-Cache-Build'),'next-build');await next.arrayBuffer();await f.drain();assert.equal(f.calls,3);
 }finally{Date.now=oldNow;f.restore();}
});

test('private requests, suspended builds and unknown cookies never read or persist shared storage',async()=>{
 const f=fixture();try{
  for(const headers of [{Accept:'text/html',Authorization:'private'},{Accept:'text/html',Cookie:'unknown_private_session=x'},{Accept:'text/html','Next-Action':'mutation'}]){await(await worker.fetch(request('/',headers),f.env,f.ctx)).arrayBuffer();await f.drain();}
  assert.equal(f.store.reads,0);assert.equal(f.store.writes,0);assert.equal(globalPublicVariant(request(),'pending-next'),false);
 }finally{f.restore();}
});

test('global storage failures, malformed and oversized envelopes fall through without retries',async()=>{
 const key=request('/__vii-edge/key'),build='test',headers=new Headers({'Content-Type':'text/html','X-VII-Cache-Build':build,'X-VII-Cache-Until':String(Date.now()+10000),'Cache-Control':'public,max-age=10'});
 const store=bucket();await writeGlobalPublicCache(store,key,build,new Uint8Array([1,2]),headers);assert.equal(store.writes,1);assert.equal((await readGlobalPublicCache(store,key,build)).status,200);
 for(const value of [new Uint8Array([0,0,0,1,123]),new Uint8Array(2*1024*1024+16389)]){for(const k of store.data.keys())store.data.set(k,value);assert.equal(await readGlobalPublicCache(store,key,build),undefined);}
 let reads=0;assert.equal(await readGlobalPublicCache({async get(){reads++;throw Error('storage');}},key,build),undefined);assert.equal(reads,1);
 const hanging={get:()=>new Promise(()=>{})};const start=Date.now();assert.equal(await readGlobalPublicCache(hanging,key,build),undefined);assert.ok(Date.now()-start<1000);
});

test('global writes reject private policy, empty bodies and extended freshness rather than extending discovery authority',async()=>{
 const store=bucket(),key=request('/__vii-edge/key'),build='test';
 const base={'Content-Type':'text/html','X-VII-Cache-Build':build,'X-VII-Cache-Until':String(Date.now()+10000),'Cache-Control':'public,max-age=10'};
 for(const policy of ['private,max-age=10','no-store','no-cache']) await writeGlobalPublicCache(store,key,build,new Uint8Array([1]),new Headers({...base,'Cache-Control':policy}));
 await writeGlobalPublicCache(store,key,build,new Uint8Array(),new Headers(base));
 await writeGlobalPublicCache(store,key,build,new Uint8Array([1]),new Headers({...base,'X-VII-Cache-Until':String(Date.now()+600_000)}));
 assert.equal(store.writes,0);
});
