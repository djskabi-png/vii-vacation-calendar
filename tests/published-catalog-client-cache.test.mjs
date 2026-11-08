import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPublishedSearchCatalog, peekFreshPublishedSearchCatalog } from '../app/lib/published-catalog-client-cache.ts';
import { discoveryJson } from '../app/lib/discovery-client-cache.ts';
import {readFileSync} from 'node:fs';
const body=(id=1)=>({entries:[{summary:{id,name:'supplier-'+id}}]});
const response=value=>Response.json(value);
let serial=0;
async function fixture(run){const oldFetch=fetch,oldNow=Date.now,oldWindow=globalThis.window;let clock=1_800_000_000_000+(++serial)*1_000_000;Date.now=()=>clock;try{await run({advance:ms=>clock+=ms})}finally{globalThis.fetch=oldFetch;Date.now=oldNow;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}}
const turn=()=>new Promise(resolve=>setImmediate(resolve));

test('simultaneous subscribers share one GET; one abort detaches without cancelling the other',()=>fixture(async()=>{
 let reads=0,release,networkSignal;globalThis.fetch=async(url,init)=>{reads++;assert.equal(url,'/api/catalog?world=vacations&view=search');assert.equal(init.method,undefined);networkSignal=init.signal;await new Promise(resolve=>release=resolve);return response(body());};
 const a=new AbortController(),b=new AbortController();const first=fetchPublishedSearchCatalog('vacations',a.signal),second=fetchPublishedSearchCatalog('vacations',b.signal);a.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(networkSignal.aborted,false);release();assert.deepEqual(await second,body());assert.equal(reads,1);
}));

test('fresh navigation reuses complete supplier facts without another network read',()=>fixture(async()=>{
 let reads=0;globalThis.fetch=async()=>{reads++;return response(body(7));};assert.deepEqual(await fetchPublishedSearchCatalog('vacations'),body(7));assert.deepEqual(await fetchPublishedSearchCatalog('vacations'),body(7));assert.equal(reads,1);
}));

test('fresh browser snapshot is synchronous, cloned, world-isolated, and never available during SSR',()=>fixture(async()=>{
 let reads=0;globalThis.fetch=async()=>{reads++;return response(body(8));};
 globalThis.window={};
 await fetchPublishedSearchCatalog('vacations');
 assert.equal(peekFreshPublishedSearchCatalog('events'),null);
 assert.equal(peekFreshPublishedSearchCatalog('vacations').entries[0].summary.id,8);
 const snapshot=peekFreshPublishedSearchCatalog('vacations');snapshot.entries[0].summary.id=99;
 assert.equal(peekFreshPublishedSearchCatalog('vacations').entries[0].summary.id,8);
 delete globalThis.window;assert.equal(peekFreshPublishedSearchCatalog('vacations'),null);globalThis.window={};assert.equal(reads,1);
}));

test('fresh browser snapshot expires exactly at its original freshness boundary',()=>fixture(async({advance})=>{
 let reads=0;globalThis.fetch=async()=>{reads++;return response(body(3));};await fetchPublishedSearchCatalog('vacations');globalThis.window={};advance(60_000);assert.equal(peekFreshPublishedSearchCatalog('vacations'),null);assert.equal(reads,1);
}));

test('a malformed value cached by another caller cannot become a public search snapshot',()=>fixture(async()=>{
 globalThis.fetch=async()=>response({entries:[{}]});
 await discoveryJson('/api/catalog?world=vacations&view=search','published-catalog-search-v1',{freshMs:60_000,staleMs:270_000,retries:0,staleWhileRevalidate:false});
 globalThis.window={};assert.equal(peekFreshPublishedSearchCatalog('vacations'),null);
}));

test('read-only snapshots cannot reuse a POST value even under the same generic cache key',()=>fixture(async()=>{
 globalThis.fetch=async()=>response(body(77));
 await discoveryJson('/api/catalog?world=vacations&view=search','published-catalog-search-v1',{method:'POST',freshMs:60_000,staleMs:270_000,retries:0,staleWhileRevalidate:false});
 globalThis.window={};assert.equal(peekFreshPublishedSearchCatalog('vacations'),null);
}));

test('expired fresh window waits for refresh and delivers new data to the mounted view',()=>fixture(async({advance})=>{
 let reads=0,release;globalThis.fetch=async()=>{reads++;if(reads===2)await new Promise(resolve=>release=resolve);return response(body(reads));};await fetchPublishedSearchCatalog('events');advance(60_001);let settled=false;const current=fetchPublishedSearchCatalog('events').then(x=>{settled=true;return x});await turn();assert.equal(settled,false,'old snapshot is not silently kept while the hook misses the refresh');release();assert.deepEqual(await current,body(2));assert.equal(reads,2);
}));

test('failed refresh may retain accepted snapshot only inside the270second hard window',()=>fixture(async({advance})=>{
 let reads=0;globalThis.fetch=async()=>{reads++;if(reads>1)throw Error('network');return response(body(9));};await fetchPublishedSearchCatalog('vacations');advance(61_000);assert.deepEqual(await fetchPublishedSearchCatalog('vacations'),body(9));advance(210_000);await assert.rejects(fetchPublishedSearchCatalog('vacations'),/network/);assert.equal(reads,3);
}));

test('malformed entries are rejected and never cached; another world is independent',()=>fixture(async()=>{
 let reads=0;globalThis.fetch=async url=>{reads++;return response(url.includes('events')?body(2):{entries:[{}]});};await assert.rejects(fetchPublishedSearchCatalog('vacations'),/invalid_response/);assert.deepEqual(await fetchPublishedSearchCatalog('events'),body(2));await assert.rejects(fetchPublishedSearchCatalog('vacations'),/invalid_response/);assert.equal(reads,3);
}));

test('already aborted subscriber starts no request and no other world or transaction can use this cache',()=>fixture(async()=>{
 let reads=0;globalThis.fetch=async()=>{reads++;return response(body())};const c=new AbortController();c.abort();await assert.rejects(fetchPublishedSearchCatalog('events',c.signal),{name:'AbortError'});await assert.rejects(fetchPublishedSearchCatalog('rooms'),/invalid_catalog_world/);await assert.rejects(fetchPublishedSearchCatalog('spa'),/invalid_catalog_world/);assert.equal(reads,0);
}));

test('deadline includes stalled JSON body after successful headers',()=>fixture(async()=>{
 const oldSet=setTimeout;let signal,bodyStarted=false;globalThis.setTimeout=(fn,ms,...args)=>oldSet(fn,ms===10_000?10:ms,...args);
 globalThis.fetch=async(_url,init)=>{signal=init.signal;return new Response(new ReadableStream({start(controller){bodyStarted=true;controller.enqueue(new TextEncoder().encode('{"entries":'));init.signal.addEventListener('abort',()=>controller.error(init.signal.reason),{once:true});}}));};
 try{await assert.rejects(fetchPublishedSearchCatalog('events'),{name:'TimeoutError'});assert.equal(bodyStarted,true);assert.equal(signal.aborted,true);}finally{globalThis.setTimeout=oldSet;}
}));

test('other discovery consumers retain their existing stale-while-revalidate behavior',()=>fixture(async({advance})=>{
 let reads=0,release;globalThis.fetch=async()=>{reads++;if(reads===2)await new Promise(resolve=>release=resolve);return response(body(reads));};const url='/api/catalog?world=vacations&view=search',scope='unmodified-default-discovery';await discoveryJson(url,scope,{freshMs:60_000,staleMs:270_000,retries:0});advance(61_000);assert.deepEqual(await discoveryJson(url,scope,{freshMs:60_000,staleMs:270_000,retries:0}),body(1));release();await turn();
}));

test('card projection remains uncached and other worlds preserve their original projection',()=>{
 const source=readFileSync(new URL('../app/lib/use-published-catalog.ts',import.meta.url),'utf8');assert.match(source,/view === "cards"[\s\S]*?shouldCache: \(\) => false/);assert.match(source,/world === "vacations" \|\| world === "events"\s*\? await fetchPublishedSearchCatalog/);assert.match(source,/const response = await fetch\(url, \{ signal: controller.signal \}\)/);
});
