import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {holidayParts} from '../app/lib/holiday-deal-selection.ts';
import {regionalAvailabilityRegion,regionalPublishedIds} from '../app/lib/regional-availability.ts';
import {eligibleDealDate} from '../app/lib/deal-clock.ts';
import {homeDealDates} from '../app/lib/vii-home-deals.ts';
import {firstDealDate} from '../app/lib/deal-clock.ts';
import {validDate} from '../app/lib/vii-live-search.ts';
import {prioritizeOnlineFirst,isHomeDealOnlineEligible} from '../app/lib/vacation-online-first.ts';
import {compareVacationPriority} from '../app/lib/vacation-priority.ts';

async function loadRoute(name, dependencies) {
  dependencies={homeDealDates,firstDealDate,validDate,prioritizeOnlineFirst,isHomeDealOnlineEligible,compareVacationPriority,runtimeCatalogDatabase:async()=>null,discoveryVacationCatalog:()=>async()=>new Map(),
    getDiscoveryHolidays:async()=>[{id:123,from:'2099-12-05',till:'2099-12-07',nights:1}],cachedDiscovery:async({load})=>({value:await load(),cache:{status:'refreshed',checkedAt:new Date().toISOString()}}),...dependencies};
  const source=await readFile(new URL(`../app/api/vii/${name}/route.ts`,import.meta.url),'utf8');
  const compiled=stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm,''),{mode:'strip'}).replace('export async function GET','async function GET');
  return new Function(...Object.keys(dependencies),`${compiled}; return GET;`)(...Object.values(dependencies));
}

for(const name of ['home-deals','home-holiday-deals'])test(`${name} starts independent work before slow catalog completes and preserves fresh result`,async()=>{
  const calls=[];let releaseNames;
  const dependencies={
    publicCatalogSummaries(){calls.push('names');return new Promise(resolve=>{releaseNames=resolve;});},
    publishedSupplierIds(){calls.push('ids');return Promise.resolve(new Set([1]));},
    supplierToken(){calls.push('token');return Promise.resolve('synthetic-test');},
    homeDealPeriods:[{id:'tomorrow'}], holidayParts, isContentLocale:()=>true, regionalAvailabilityRegion, regionalPublishedIds,eligibleDealDate,
    readHomeDisplaySettings:async()=>({periods:[{id:'tomorrow'}],defaultPeriod:'tomorrow'}),
    curateHomeDeals:async(_db,deals)=>deals,
  };
  const supplier=async(input)=>{
    assert.equal(input.token,'synthetic-test');assert.equal(input.publicNames.get(1),'Verified name');assert.deepEqual([...input.publicSiteIds],[1]);
    if (name === 'home-holiday-deals') { assert.equal(input.guests, 2); assert.equal(input.part, 'all'); }
    const dates=name==='home-deals'?homeDealDates('tomorrow'):{from:'2099-12-05',till:'2099-12-06'};
    return {deals:[{siteID:1,total:350,priceGuests:2,...dates}],source:'live-test'};
  };
  dependencies.getHomeDeals=supplier;dependencies.getHomeHolidayDeals=supplier;
  const get=await loadRoute(name,dependencies);
  const responsePromise=get(new Request(`https://example.test/?${name==='home-deals'?'period=tomorrow':'id=123&from=2099-12-05&till=2099-12-06'}`));
  assert.deepEqual(calls,['names','ids','token']);
  releaseNames([{supplierId:1,name:'Verified name'}]);
  const response=await responsePromise;
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const deals=(await response.json()).deals;assert.equal(deals.length,1);assert.equal(deals[0].priceGuests,2);assert.equal(deals[0].siteID,1);
});
for(const route of ['home-deals','home-holiday-deals'])test(`${route} overlaps catalog, publication allowlist and token with discovery-only cache`,async()=>{
  const source=await readFile(new URL(`../app/api/vii/${route}/route.ts`,import.meta.url),'utf8');
  assert.match(source,/const \[names, publicSiteIds, token\] = await Promise\.all\(\[/);
  assert.match(source,/publishedSupplierIds\("vacations"\), supplierToken\(\)/);
  assert.match(source,/Cache-Control.*no-store/);
  assert.match(source,/publicSiteIds, publicNames: new Map/);
  assert.match(source,/curateHomeDeals/);
});
test('display settings start before supplier requests while holiday all mode stays unfiltered',async()=>{
  const deals=await readFile(new URL('../app/api/vii/home-deals/route.ts',import.meta.url),'utf8');
  assert.ok(deals.indexOf('const displayPromise =')<deals.indexOf('const cached = await cachedDiscovery'));
  assert.match(deals,/Promise\.all\(\[applyCuration\(result.deals, period as HomeDealPeriod\), displayPromise\]\)/);
  const holidays=await readFile(new URL('../app/api/vii/home-holidays/route.ts',import.meta.url),'utf8');
  assert.ok(holidays.indexOf('const settingsPromise =')<holidays.indexOf('await getDiscoveryHolidays'));
  assert.match(holidays,/params.get\("all"\) === "1" \? null : displaySettings/);
  assert.match(holidays,/applyHolidayDisplaySettings\(holidays, settings\)/);
});
