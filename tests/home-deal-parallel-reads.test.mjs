import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

async function loadRoute(name, dependencies) {
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
    homeDealPeriods:[{id:'tomorrow'}], isContentLocale:()=>true,
    readHomeDisplaySettings:async()=>({periods:[{id:'tomorrow'}],defaultPeriod:'tomorrow'}),
    curateHomeDeals:async(_db,deals)=>deals,
  };
  const supplier=async(input)=>{
    assert.equal(input.token,'synthetic-test');assert.equal(input.publicNames.get(1),'Verified name');assert.deepEqual([...input.publicSiteIds],[1]);
    return {deals:[{siteID:1,total:350}],source:'live-test'};
  };
  dependencies.getHomeDeals=supplier;dependencies.getHomeHolidayDeals=supplier;
  const get=await loadRoute(name,dependencies);
  const responsePromise=get(new Request(`https://example.test/?${name==='home-deals'?'period=tomorrow':'id=123&from=2026-12-05&till=2026-12-06'}`));
  assert.deepEqual(calls,['names','ids','token']);
  releaseNames([{supplierId:1,name:'Verified name'}]);
  const response=await responsePromise;
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual((await response.json()).deals,[{siteID:1,total:350}]);
});
for(const route of ['home-deals','home-holiday-deals'])test(`${route} overlaps catalog, publication allowlist and token without caching availability`,async()=>{
  const source=await readFile(new URL(`../app/api/vii/${route}/route.ts`,import.meta.url),'utf8');
  assert.match(source,/const \[names, publicSiteIds, token\] = await Promise\.all\(\[/);
  assert.match(source,/publishedSupplierIds\("vacations"\), supplierToken\(\)/);
  assert.match(source,/Cache-Control.*no-store/);
  assert.match(source,/publicSiteIds, publicNames: new Map/);
  assert.match(source,/curateHomeDeals/);
});
test('display settings start before supplier requests while holiday all mode stays unfiltered',async()=>{
  const deals=await readFile(new URL('../app/api/vii/home-deals/route.ts',import.meta.url),'utf8');
  assert.ok(deals.indexOf('const displayPromise =')<deals.indexOf('const result = await getHomeDeals'));
  assert.match(deals,/Promise\.all\(\[applyCuration\(result.deals, period as HomeDealPeriod\), displayPromise\]\)/);
  const holidays=await readFile(new URL('../app/api/vii/home-holidays/route.ts',import.meta.url),'utf8');
  assert.ok(holidays.indexOf('const settingsPromise =')<holidays.indexOf('await getHomeHolidays'));
  assert.match(holidays,/params.get\("all"\) === "1" \? null : displaySettings/);
  assert.match(holidays,/applyHolidayDisplaySettings\(holidays, settings\)/);
});
