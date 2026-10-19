import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {startingPriceFields,supplierStartingPrice,hasSearchDate,startingPriceCatalog,validStartingPriceMap,publishedStartingPrices,fetchStartingPriceCatalog} from '../app/lib/supplier-starting-price.ts';
import {cachedDiscovery} from '../app/lib/discovery-offer-cache.ts';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('only positive supplier seasonal integers form an undated advertising floor',()=>{
  assert.deepEqual(startingPriceFields({startPriceWinter:1000,startPriceSummer:1500,owner_name:'private'}),{startPriceWinter:1000,startPriceSummer:1500});
  assert.equal(supplierStartingPrice({startPriceWinter:1500,startPriceSummer:1000}),1000);
  for(const invalid of [null,0,-1,Infinity,NaN,2.5,'1000',Number.MAX_SAFE_INTEGER+1])assert.equal(supplierStartingPrice({startPriceWinter:invalid}),null);
  assert.equal(supplierStartingPrice({price:1,available:true}),null);
  assert.equal(supplierStartingPrice({startPriceWinter:0,startPriceSummer:900}),900);
});

test('full, partial, invalid and flexible date choices suppress undated prices',()=>{
  assert.equal(hasSearchDate(new URLSearchParams('guests=6&location=center')),false);
  for(const key of ['from','till','to','dates','date']){
    assert.equal(hasSearchDate(new URLSearchParams({[key]:'2026-10-23'})),true,key);
    assert.equal(hasSearchDate(new URLSearchParams({[key]:'not-a-date'})),true,key);
    assert.equal(hasSearchDate(new URLSearchParams({[key]:''})),false,key);
  }
  assert.equal(hasSearchDate(new URLSearchParams('dates=flexible')),true);
  assert.equal(hasSearchDate(new URLSearchParams('dateMode=flexible&stay=weekend&month=2026-11&flexDays=0')),true);
  assert.equal(hasSearchDate(new URLSearchParams('dateMode=flexible')),true);
  assert.equal(hasSearchDate(new URLSearchParams('dateMode=exact')),false);
});

test('source projection is world-isolated, active-only, price-only and fails closed',()=>{
  const body={places:[{siteID:2,active:true,startPriceWinter:1000,startPriceSummer:1500,contact:{owner_name:'private'}},{siteID:3,active:false,startPriceWinter:5},{siteID:4,active:true,startPriceWinter:0}]};
  assert.deepEqual(startingPriceCatalog('vacations',body),{'vacation-2':{startPriceWinter:1000,startPriceSummer:1500}});
  assert.deepEqual(startingPriceCatalog('events',body),{'event-2':{startPriceWinter:1000,startPriceSummer:1500}});
  assert.equal(validStartingPriceMap('events',{'vacation-2':{startPriceWinter:1000}}),false);
  assert.equal(validStartingPriceMap('events',{'event-2':{startPriceWinter:1000,owner:'private'}}),false);
  assert.equal(validStartingPriceMap('events',{}),true);
  for(const value of [{error:'PRIVATE SQL'},{places:[]},{places:[{siteID:2,active:true},{siteID:2,active:true}]},{places:[{siteID:-1,active:true}]}])assert.throws(()=>startingPriceCatalog('events',value),/starting_prices_unavailable/);
});

function handler(deps){
  const source=read('app/api/vii/starting-prices/route.ts').replace(/^import .*;\r?$/gm,'');
  const compiled=stripTypeScriptTypes(source,{mode:'strip'}).replace(/export async function /g,'async function ');
  return new Function('validStartingPriceMap','publishedStartingPrices',`${compiled}; return startingPricesResponse;`)(validStartingPriceMap,publishedStartingPrices);
}
const req=query=>new Request(`https://example.test/api/vii/starting-prices?${query}`);

test('actual route validates before I/O and rechecks publication after cached price lookup',async()=>{
  let reads=0;const order=[];let published=new Set([2]);
  const deps={read:async world=>{reads++;order.push('cache');return{value:{[`${world==='events'?'event':'vacation'}-2`]:{startPriceWinter:1000},[`${world==='events'?'event':'vacation'}-3`]:{startPriceSummer:700}},cache:{status:'fresh'}}},published:async()=>{order.push('publication');return published}};
  const run=handler();
  for(const query of ['world=spa','world=events&from=2026-10-23','world=events&siteID=2','world=events&world=vacations',''])assert.equal((await run(req(query),deps)).status,400);
  assert.equal(reads,0);
  const response=await run(req('world=events'),deps);const body=await response.json();
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(order,['cache','publication']);assert.deepEqual(body.prices,{'event-2':{startPriceWinter:1000}});
  published=new Set();assert.deepEqual((await(await run(req('world=events'),deps)).json()).prices,{});
});

test('actual route never leaks upstream SQL, credentials, contacts or mismatched cache',async()=>{
  const run=handler();
  for(const read of [async()=>{throw Error('PRIVATE SQL Bearer secret')},async()=>({value:{'vacation-2':{startPriceWinter:100}}}),async()=>({value:{'event-2':{startPriceWinter:100,contact:'private'}}})]){
    const response=await run(req('world=events'),{read,published:async()=>new Set([2])});
    assert.equal(response.status,503);assert.deepEqual(await response.json(),{world:'events',prices:{},error:'starting_prices_unavailable'});
  }
});

test('one server list read uses only existing bearer auth and does not forward redirects/query',async()=>{
  let calls=0;
  const prices=await fetchStartingPriceCatalog('events','test-key',async(url,options)=>{
    calls++;assert.equal(url,'https://bizonline.co.il/api/ai/vii/events');assert.equal(options.headers.Authorization,'Bearer test-key');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
    return Response.json({places:[{siteID:2,active:true,startPriceWinter:1000,contact:{owner:'private'}}]});
  });
  assert.equal(calls,1);assert.deepEqual(prices,{'event-2':{startPriceWinter:1000}});
  await assert.rejects(()=>fetchStartingPriceCatalog('events',''),/unavailable/);
  await assert.rejects(()=>fetchStartingPriceCatalog('events','test',async()=>Response.json({error:'SQL'})),/unavailable/);
  await assert.rejects(()=>fetchStartingPriceCatalog('events','test',async()=>new Response('x'.repeat(10*1024*1024+1))),/unavailable/);
});

test('existing discovery cache coalesces, isolates worlds and preserves only valid last-good browse data',async()=>{
  let now=9_000_000,calls=0;
  const load=async()=>{calls++;return{'event-2':{startPriceWinter:1000}}};
  const options={key:['starting-price-test',crypto.randomUUID(),'events'],load,now:()=>now,validate:v=>validStartingPriceMap('events',v)};
  const [first,second]=await Promise.all([cachedDiscovery(options),cachedDiscovery(options)]);
  assert.equal(calls,1);assert.deepEqual(first.value,second.value);
  now+=16*60_000;
  const stale=await cachedDiscovery({...options,load:async()=>{throw Error('SQL')}});
  assert.deepEqual(stale.value,first.value);assert.equal(stale.cache.status,'stale');
  now+=25*60*60_000;
  await assert.rejects(()=>cachedDiscovery({...options,load:async()=>{throw Error('SQL')}}));
  const vacation=await cachedDiscovery({...options,key:[...options.key,'vacations'],load:async()=>({'vacation-2':{startPriceSummer:800}}),validate:v=>validStartingPriceMap('vacations',v)});
  assert.deepEqual(vacation.value,{'vacation-2':{startPriceSummer:800}});
});

test('all search card callers guard dates without changing live quotes, ranking or online evidence',()=>{
  const vacation=read('app/components/property-card.tsx'),events=read('app/events/search/page.tsx');
  assert.match(vacation,/undatedSearch = !selectedStay && !hasSearchDate\(searchParams\)/);
  assert.match(vacation,/undatedSearch && !resolvedAvailability && !promotional \? supplierStartingPrice/);
  assert.equal((read('app/search/page.tsx').match(/catalogStartingPrices=\{startingPrices\[property.slug\]\}/g)||[]).length,2);
  assert.match(events,/useStartingPrices\("events", undatedSearch\)/);
  assert.match(events,/startingPrice=\{undatedSearch \? supplierStartingPrice/);
  assert.match(read('app/components/event-result-card.tsx'),/supplierStatus \? <p[^]*? : startingPrice \? <CatalogStartingPrice/);
  assert.doesNotMatch(read('app/components/catalog-starting-price.tsx'),/night|per event|ללילה|לאירוע|onlineBooking|available/);
  assert.match(read('app/lib/sergey-public-catalog-client.ts'),/\.\.\.startingPriceFields\(raw\)/);
  assert.match(read('app/lib/public-vacation-search.ts'),/startPriceWinter: property.startPriceWinter/);
});

test('actual client hook clears previous prices for malformed 200, wrong-world and failed responses',async()=>{
  let state, effect, nextResponse;
  const source=read('app/lib/use-starting-prices.ts').replace(/^import .*;\r?$/gm,'').replace(/^"use client";/,'');
  const compiled=stripTypeScriptTypes(source,{mode:'strip'}).replace('export function useStartingPrices','function useStartingPrices');
  const hook=new Function('useState','useEffect','validStartingPriceMap','fetch',`${compiled};return useStartingPrices;`)(
    initial=>{state??=initial;return[state,value=>{state=value}]},
    callback=>{effect=callback},validStartingPriceMap,async()=>nextResponse,
  );
  for(const invalid of [Response.json({world:'vacations',prices:{'vacation-2':{startPriceWinter:100}}}),Response.json({world:'events',prices:{'event-2':{startPriceWinter:0}}}),Response.json({}),new Response('',{status:503})]){
    state={'event-2':{startPriceWinter:1000}};nextResponse=invalid;
    hook('events',true);effect();
    for(let n=0;n<12;n++)await Promise.resolve();
    assert.deepEqual(state,{});
  }
  state={'event-2':{startPriceWinter:1000}};
  assert.deepEqual(hook('events',false),{});
});
