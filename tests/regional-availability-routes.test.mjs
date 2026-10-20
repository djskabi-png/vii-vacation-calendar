import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { regionalAvailabilityRegion, regionalPublishedIds, selectRegionalOffers } from '../app/lib/regional-availability.ts';
import { matchesSearchLocation } from '../app/data/search-taxonomy.ts';
import { spaPlusArea } from '../app/data/spa-regions.ts';
import { selectSpaPackageDeals } from '../app/lib/spa-package-deals.ts';
import { eventDealDate } from '../app/lib/event-deal-dates.ts';
import { dealRailDays, eligibleDealDate, firstDealDate } from '../app/lib/deal-clock.ts';
import { homeDealDates } from '../app/lib/vii-home-deals.ts';
import { prioritizeOnlineFirst,isHomeDealOnlineEligible } from '../app/lib/vacation-online-first.ts';
import { compareVacationPriority } from '../app/lib/vacation-priority.ts';

function handler(path, method, dependencies) {
  dependencies={firstDealDate,prioritizeOnlineFirst,isHomeDealOnlineEligible,compareVacationPriority,runtimeCatalogDatabase:async()=>null, cachedDiscovery:async({load})=>({value:await load(),cache:{status:'refreshed',checkedAt:new Date().toISOString()}}),homeDealDates,
    VACATION_DISCOVERY_POLICY:{freshMs:30*60_000,staleMs:30*86_400_000},
    readCachedDiscovery:async()=>{throw new Error('missing_snapshot_fixture');},
    discoveryVacationCatalog:()=>async()=>new Map(),...dependencies};
  const source=readFileSync(new URL(`../app/api/${path}/route.ts`,import.meta.url),'utf8');
  const compiled=stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm,''),{mode:'strip'}).replace(`export async function ${method}`,`async function ${method}`);
  return new Function(...Object.keys(dependencies),`${compiled}; return ${method};`)(...Object.values(dependencies));
}
const request=(path,body)=>new Request(`https://example.test/${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);

test('actual vacation handler validates scope before reads, joins publication and returns the region',async()=>{
  let calls=0;
  const get=handler('vii/home-deals','GET',{
    regionalAvailabilityRegion,regionalPublishedIds,selectRegionalOffers,eligibleDealDate,isContentLocale:()=>true,homeDealPeriods:[{id:'tomorrow'}],
    publicCatalogSummaries:async()=>{calls++;return[{supplierId:1,name:'Center',area:'מרכז'},{supplierId:2,name:'North',area:'גליל מערבי'},{supplierId:3,name:'Hidden',area:'צפון'}];},
    publishedSupplierIds:async()=>new Set([1,2]),
    readHomeDisplaySettings:async()=>({periods:[{id:'tomorrow'}],defaultPeriod:'tomorrow'}),
    readCachedDiscovery:async({key})=>{assert.equal(key.at(-1),6);return {cache:{status:'fresh',checkedAt:new Date().toISOString()},value:{dates:homeDealDates('tomorrow'),deals:[{siteID:2,total:600,priceGuests:6,from:homeDealDates('tomorrow').from,till:homeDealDates('tomorrow').till}]}};},
  });
  for(const query of ['period=tomorrow&region=unknown','period=tomorrow&guests=0','period=tomorrow&guests=51','period=tomorrow&guests=2.5']) assert.equal((await get(request(`?${query}`))).status,400);
  assert.equal(calls,0);
  const response=await get(request(`?${new URLSearchParams({period:'tomorrow',region:'צפון',guests:'6'})}`));
  const body=await response.json();
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(body.region,'צפון');assert.deepEqual(body.deals.map(deal=>deal.siteID),[2]);
});

test('actual event handler selects regional public IDs before national top12 and echoes scope',async()=>{
  const places=Array.from({length:26},(_,i)=>({supplierId:i+1,slug:`event-${i+1}`,name:`Venue ${i+1}`,location:i<20?'נתניה':'צפת',area:i<20?'מרכז':'צפון',type:'Venue',guests:50,image:'https://www.vii.co.il/gallery/venue.jpg',images:[]}));
  places[20].contact={phone:'050-111-1111',whatsapp:'050-222-2222',privateNote:'must-not-be-projected'};
  places[21].contact={phone:'050-333-3333'};
  const post=handler('vii/live-search','POST',{
    // This eligibility fixture must not depend on the developer's wall clock.
    Date:class extends Date {constructor(...args){super(...(args.length?args:['2026-10-17T12:00:00Z']));}},
    regionalAvailabilityRegion,regionalPublishedIds,selectRegionalOffers,eligibleDealDate,validDate:value=>/^\d{4}-\d{2}-\d{2}$/.test(value),
    supplierToken:async()=>'test',publishedSupplierIds:async()=>new Set(places.slice(0,-1).map(place=>place.supplierId)),
    publicCatalogSummaries:async()=>places,
    publicCatalogSelectedSummaries:async(_world,ids)=>places.filter(place=>ids.includes(place.supplierId)),
    readCachedDiscovery:async ({key})=>{assert.deepEqual(key,['events-discovery','2026-10-18','2026-10-18',30,'both']);return{cache:{status:'fresh',checkedAt:'2026-10-17T12:00:00Z'},value:{checkedAt:'2026-10-17T12:00:00Z',results:Array.from({length:25},(_,index)=>({siteID:index+1,total:(index+1)*100,available:true,slot:'evening',from:'2026-10-18'}))}};},
    EVENT_DISCOVERY_POLICY:{freshMs:30*60_000,staleMs:30*86_400_000},
    liveSupplierSearch:async()=>{throw new Error('visitor_must_not_call_provider');},
  });
  const selection={world:'events',from:'2026-10-18',till:'2026-10-18',guests:30,includePlaces:true,region:'צפון'};
  for(const overrides of [{region:'invalid'},{includePlaces:false},{world:'vacations'}]) assert.equal((await post(request('/',{...selection,...overrides}))).status,400);
  const response=await post(request('/',selection));const body=await response.json();
  assert.equal(response.status,200);assert.equal(body.region,'צפון');assert.equal(body.places.length,5);
  assert.ok(body.places.every(place=>place.area==='צפון'));
  assert.deepEqual(body.places.find(place=>place.slug==='event-21').contact,{phone:'050-111-1111',whatsapp:'050-222-2222'});
  assert.deepEqual(body.places.find(place=>place.slug==='event-22').contact,{phone:'050-333-3333'});
  assert.equal(body.places.find(place=>place.slug==='event-23').contact,undefined);
  assert.doesNotMatch(JSON.stringify(body.places),/privateNote|must-not-be-projected/);
});

test('actual spa handler filters source sites before cap and returns honest empty/error states',async()=>{
  const image='https://www.spaplus.co.il/gallery/venue.jpg';
  const sites=Array.from({length:24},(_,i)=>({id:i+1,title:`Spa ${i+1}`,city:i<20?'תל אביב':'צפת',image,packages:[{id:i+1,title:'Package',price:i+1,people:1,group:false,image}]}));
  const dependencies={regionalAvailabilityRegion,selectRegionalOffers,matchesSearchLocation,spaPlusArea,selectSpaPackageDeals,eventDealDate,dealRailDays,
    publicCatalogSummaries:async()=>sites,readSpaAvailability:async()=>sites.map(site=>({siteID:site.id,date:dealRailDays(6)[0],available:2}))};
  const get=handler('spa/deals','GET',dependencies);
  const response=await get(request(`?${new URLSearchParams({region:'צפון'})}`));const body=await response.json();
  assert.equal(body.region,'צפון');assert.deepEqual(body.offers[body.days[0]].single.map(offer=>offer.siteId),[21,22,23,24]);
  const wider=await (await get(request(`?${new URLSearchParams({region:'ים המלח'})}`))).json();assert.equal(wider.offers[wider.days[0]].single.length,3);assert.equal(wider.expandedRegions[wider.days[0]].single,true);
  assert.deepEqual(wider.offers[wider.days[1]].single,[]);
  assert.equal((await get(request('?region=unknown'))).status,400);
  const failed=handler('spa/deals','GET',{...dependencies,readSpaAvailability:async()=>{throw new Error('offline');}});
  assert.equal((await failed(request('/'))).status,503);
});

test('event rail date guard respects Israel cutoff and midnight with an explicit clock',async()=>{
  for(const [clock,date,status] of [
    ['2026-10-18T11:00:59Z','2026-10-18',200],
    ['2026-10-18T11:01:00Z','2026-10-18',400],
    ['2026-10-18T21:00:00Z','2026-10-19',400],
    ['2026-10-18T21:01:00Z','2026-10-19',200],
  ]){
    let reads=0;
    const post=handler('vii/live-search','POST',{
      Date:class extends Date {constructor(...args){super(...(args.length?args:[clock]));}},
      regionalAvailabilityRegion,regionalPublishedIds,selectRegionalOffers,eligibleDealDate,validDate:()=>true,
      supplierToken:async()=>{reads++;return 'fixture';},publishedSupplierIds:async()=>new Set(),
      publicCatalogSummaries:async()=>[],publicCatalogSelectedSummaries:async()=>[],
      readCachedDiscovery:async()=>({cache:{status:'fresh',checkedAt:clock},value:{results:[{siteID:1,total:100,available:true,slot:'evening',from:date}]}}),
      EVENT_DISCOVERY_POLICY:{freshMs:30*60_000,staleMs:30*86_400_000},
      liveSupplierSearch:async()=>({results:[]}),
    });
    const response=await post(request('/',{world:'events',from:date,till:date,guests:30,slot:'evening',includePlaces:true,region:'צפון'}));
    assert.equal(response.status,status,clock);assert.equal(reads,status===200?1:0,clock);
  }
});
