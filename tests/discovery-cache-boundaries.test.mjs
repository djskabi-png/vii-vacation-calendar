import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {homeDealDates} from '../app/lib/vii-home-deals.ts';
import {regionalAvailabilityRegion,selectRegionalOffers} from '../app/lib/regional-availability.ts';
import {eligibleDealDate} from '../app/lib/deal-clock.ts';
import {discoveryJson} from '../app/lib/discovery-client-cache.ts';
import {prioritizeOnlineFirst,isHomeDealOnlineEligible} from '../app/lib/vacation-online-first.ts';
import {compareVacationPriority} from '../app/lib/vacation-priority.ts';
import {VACATION_DISCOVERY_POLICY} from '../app/lib/warm-vacation-discovery-cache.ts';

function route(path,method,deps){
 const text=readFileSync(new URL(`../app/api/${path}/route.ts`,import.meta.url),'utf8');
 const js=stripTypeScriptTypes(text.replace(/^import .*;\r?$/gm,''),{mode:'strip'}).replace(`export async function ${method}`,`async function ${method}`);
 return new Function(...Object.keys(deps),`${js};return ${method};`)(...Object.values(deps));
}
test('actual vacation route only reads scheduled snapshots, re-filters withdrawn IDs and preserves party/date keys',async()=>{
 let reads=0,ids=new Set([11,12]);const date=homeDealDates('tomorrow');
 const readCachedDiscovery=async({key})=>{reads++;const guests=key.at(-1);return{cache:{status:'fresh',checkedAt:new Date().toISOString()},value:{dates:date,checkedAt:new Date().toISOString(),deals:[11,12].map(siteID=>({siteID,total:900,priceGuests:guests,from:date.from,till:date.till}))}};};
 const get=route('vii/home-deals','GET',{readCachedDiscovery,homeDealDates,regionalAvailabilityRegion,selectRegionalOffers,prioritizeOnlineFirst,isHomeDealOnlineEligible,compareVacationPriority,eligibleDealDate,VACATION_DISCOVERY_POLICY,homeDealPeriods:[{id:'tomorrow'}],isContentLocale:()=>true,
  runtimeCatalogDatabase:async()=>null,publishedSupplierIds:async()=>ids,
  publicCatalogSummaries:async()=>[{supplierId:11,name:'Local',area:'מרכז'},{supplierId:12,name:'Other',area:'צפון'}],
  readHomeDisplaySettings:async()=>({periods:[{id:'tomorrow'}],defaultPeriod:'tomorrow'}),
 });
 const query=(region,guests=3)=>new Request(`https://example.test/?${new URLSearchParams({period:'tomorrow',region,guests:String(guests)})}`);
 const first=await(await get(query('מרכז'))).json();assert.equal(first.cache.status,'fresh');
 const second=await(await get(query('צפון'))).json();assert.equal(second.cache.status,'fresh');
 ids=new Set([12]);const withdrawn=await(await get(query('מרכז'))).json();assert.ok(withdrawn.deals.every(deal=>deal.siteID!==11));
 await get(query('מרכז',6));assert.equal(reads,4);
});
test('detail and booking adapters never import discovery cache; event opt-in stays explicit',()=>{
 for(const path of ['app/lib/vii-confirm-home-deal.ts','app/api/vii/confirm-home-deal/route.ts','app/api/spa/availability/route.ts','app/lib/vii-live-search.ts']){
  const text=readFileSync(new URL(`../${path}`,import.meta.url),'utf8');assert.doesNotMatch(text,/cachedDiscovery|discoveryJson|discovery-offer-cache/);
 }
 const text=readFileSync(new URL('../app/api/vii/live-search/route.ts',import.meta.url),'utf8');assert.match(text,/world === "events" && body.includePlaces === true/);assert.match(text,/cached\?\.value \?\? await load\(\)/);
});
test('browser navigation cache does not cross URL/body/clock selections or store failures',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return Response.json({deals:[calls]});};
  const a=await discoveryJson('/api/test-discovery','day1');a.deals.push(99);
  assert.deepEqual(await discoveryJson('/api/test-discovery','day1'),{deals:[1]});assert.equal(calls,1);
  await discoveryJson('/api/test-discovery','day2');await discoveryJson('/api/test-discovery','day2',{method:'POST',body:'party6'});assert.equal(calls,3);
  globalThis.fetch=async()=>{calls++;return new Response('',{status:503});};
  await assert.rejects(discoveryJson('/api/test-failure','day1'));await assert.rejects(discoveryJson('/api/test-failure','day1'));assert.equal(calls,5);
 }finally{globalThis.fetch=original;}
});
