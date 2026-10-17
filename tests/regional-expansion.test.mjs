import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { regionalAvailabilityRegion, selectRegionalOffers } from '../app/lib/regional-availability.ts';
import { applyHomeDealCuration } from '../app/lib/home-deal-curation.ts';
import { eventDealDate } from '../app/lib/event-deal-dates.ts';
import { dealRailDays, eligibleDealDate } from '../app/lib/deal-clock.ts';
import { selectSpaPackageDeals } from '../app/lib/spa-package-deals.ts';
import { spaPlusArea } from '../app/data/spa-regions.ts';
import { regionalExpansionCopy } from '../app/i18n/regional-availability-copy.ts';

const places = [
  {supplierId:1,name:'Local1',location:'צפת',area:'צפון',lat:33.0,lng:35.4,image:'https://example.test/1.jpg'},
  {supplierId:2,name:'Local2',location:'צפת',area:'צפון',lat:33.02,lng:35.42,image:'https://example.test/2.jpg'},
  {supplierId:3,name:'LocalUnavailable',location:'צפת',area:'צפון',lat:33.03,lng:35.4,image:'https://example.test/3.jpg'},
  {supplierId:4,name:'LocalUnavailable2',location:'צפת',area:'צפון',lat:33.04,lng:35.4,image:'https://example.test/4.jpg'},
  {supplierId:5,name:'FarCheap',location:'באר שבע',area:'דרום ונגב',lat:31.25,lng:34.8,image:'https://example.test/5.jpg'},
  {supplierId:6,name:'Near',location:'נתניה',area:'מרכז',lat:32.32,lng:34.86,image:'https://example.test/6.jpg'},
  {supplierId:7,name:'Hidden',location:'צפת',area:'צפון',lat:33,lng:35.4,image:'https://example.test/7.jpg'},
];
const options={placeId:o=>o.siteID,key:o=>String(o.siteID)};
const offers=[{siteID:5,total:10},{siteID:1,total:100},{siteID:2,total:200},{siteID:6,total:900}];
const publicPlaces=places.filter(p=>p.supplierId!==7);
function handler(path,method,dependencies){
  const source=readFileSync(new URL(`../app/api/${path}/route.ts`,import.meta.url),'utf8');
  const compiled=stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm,''),{mode:'strip'}).replace(`export async function ${method}`,`async function ${method}`);
  return new Function(...Object.keys(dependencies),`${compiled};return ${method};`)(...Object.values(dependencies));
}
test('expansion counts live offers not catalog, preserves region and picks nearest over cheapest',()=>{
  const selected=selectRegionalOffers(offers,publicPlaces,'צפון',options);
  assert.deepEqual(selected.order,[1,2,6]); assert.equal(selected.expanded,true);
  assert.equal(selectRegionalOffers([...offers,{siteID:7,total:1}],publicPlaces,'צפון',options).offers.length,3);
});
test('selection preserves every local offer and never caps national candidates before geography',()=>{
  const many=Array.from({length:30},(_,i)=>({supplierId:100+i,area:'מרכז',lat:32.1,lng:34.9}));
  const local=Array.from({length:6},(_,i)=>({supplierId:200+i,area:'צפון',lat:33,lng:35.4}));
  const selected=selectRegionalOffers([...many,...local].map(p=>({siteID:p.supplierId})),[...many,...local],'צפון',{...options,limit:12});
  assert.deepEqual(selected.order,local.map(p=>p.supplierId)); assert.equal(selected.expanded,false);
});
test('fewer than three true offers stays honest; duplicates and unknown geography cannot manufacture a neighbor',()=>{
  assert.deepEqual(selectRegionalOffers([offers[1],offers[1]],publicPlaces,'צפון',options).order,[1]);
  assert.deepEqual(selectRegionalOffers([{siteID:99}], [{supplierId:99}], 'צפון',options).offers,[]);
  assert.deepEqual(selectRegionalOffers([],publicPlaces,'צפון',options),{offers:[],expanded:false,order:[]});
});
test('editorial exclusions are applied before minimum-three completion',()=>{
  const curated=applyHomeDealCuration([...offers,{siteID:3,total:300}],[{key:'3',content:{attributes:{homeDealHidden:'true'}}}],'tomorrow');
  assert.deepEqual(selectRegionalOffers(curated,publicPlaces,'צפון',options).order,[1,2,6]);
});
test('actual vacation API uses one complete eligible read and returns minimum-three metadata with party intact',async()=>{
  let reads=0;
  const get=handler('vii/home-deals','GET',{
    regionalAvailabilityRegion,selectRegionalOffers,eligibleDealDate,isContentLocale:()=>true,homeDealPeriods:[{id:'tomorrow'}],
    publicCatalogSummaries:async()=>places,publishedSupplierIds:async()=>new Set([1,2,3,4,5,6]),supplierToken:async()=>'test',
    readHomeDisplaySettings:async()=>({periods:[{id:'tomorrow'}],defaultPeriod:'tomorrow'}),
    getHomeDeals:async input=>{reads++;assert.equal(input.guests,6);assert.equal(input.publicSiteIds.size,6);return{period:'tomorrow',dates:{from:'2026-10-18',till:'2026-10-19'},deals:offers.map(o=>({...o,priceGuests:6,from:eventDealDate(1)}))};},
  });
  const response=await get(new Request(`https://example.test/?${new URLSearchParams({region:'צפון',period:'tomorrow',guests:'6'})}`));
  const body=await response.json();assert.equal(response.status,200);assert.equal(reads,1);assert.equal(body.expandedRegion,true);assert.deepEqual(body.regionalOrder,[1,2,6]);assert.ok(body.deals.every(o=>o.priceGuests===6));
});
test('actual event API excludes unavailable/missing images before expansion and preserves exact slot/party',async()=>{
  const post=handler('vii/live-search','POST',{
    regionalAvailabilityRegion,selectRegionalOffers,eligibleDealDate,validDate:()=>true,supplierToken:async()=>'test',publishedSupplierIds:async()=>new Set([1,2,3,4,5,6]),
    publicCatalogSummaries:async()=>places,
    publicCatalogSelectedSummaries:async(_world,ids)=>places.filter(p=>ids.includes(p.supplierId)).map(p=>({...p,slug:`event-${p.supplierId}`,images:[]})),
    liveSupplierSearch:async input=>{assert.equal(input.guests,30);assert.equal(input.slot,'evening');return{results:[...offers.map(o=>({...o,available:true,slot:'evening',from:input.from})),{siteID:3,available:false,total:1},{siteID:7,available:true,total:1,slot:'evening'}]};},
  });
  const response=await post(new Request('https://example.test/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({world:'events',from:'2026-10-18',till:'2026-10-18',guests:30,slot:'evening',includePlaces:true,region:'צפון'})}));
  const body=await response.json();assert.equal(response.status,200);assert.equal(body.expandedRegion,true);assert.deepEqual(body.regionalOrder,[1,2,6]);assert.deepEqual(body.results.map(o=>o.siteID),[1,2,6]);
});
test('actual SPA expansion is after availability and cap, with selection-specific disclosure and local price order',async()=>{
  const image='https://www.spaplus.co.il/gallery/test.jpg';
  const sites=Array.from({length:24},(_,i)=>({id:i+1,title:`Spa${i+1}`,city:i<22?'תל אביב':'צפת',lat:i<22?32.1:33,lng:i<22?34.9:35.4,image,
    packages:[{id:i+1,title:'Package',price:i+1,people:1,group:false,image}]}));
  const [day,next]=dealRailDays(6);
  const get=handler('spa/deals','GET',{regionalAvailabilityRegion,selectRegionalOffers,spaPlusArea,selectSpaPackageDeals,eventDealDate,dealRailDays,
    publicCatalogSummaries:async()=>sites,readSpaAvailability:async()=>sites.filter(s=>[21,23,24].includes(s.id)).map(s=>({siteID:s.id,date:day,available:2}))});
  const response=await get(new Request(`https://example.test/?${new URLSearchParams({region:'צפון'})}`));const body=await response.json();
  assert.equal(response.status,200);assert.deepEqual(body.offers[day].single.map(o=>o.siteId),[23,24,21]);assert.equal(body.expandedRegions[day].single,true);
  assert.equal(body.expandedRegions[day].couple,undefined);assert.equal(body.expandedRegions[next],undefined);assert.deepEqual(body.offers[next].single,[]);
});
test('all four visitor locales disclose geography only, without technical explanations or stale global SPA flags',()=>{
  for(const language of ['he','en','ru','fr'])assert.ok(regionalExpansionCopy[language].length>20);
  for(const language of ['en','ru','fr'])assert.doesNotMatch(regionalExpansionCopy[language],/[\u0590-\u05ff]/);
  const read=p=>readFileSync(new URL(`../app/components/${p}.tsx`,import.meta.url),'utf8');
  for(const p of ['home-live-deals','event-last-minute','spa-package-deals'])assert.match(read(p),/regionalExpansionCopy\[language\]/);
  assert.match(read('spa-package-deals'),/expandedRegions\?\.\[date\]\?\.\[audience\]/);
  assert.match(read('event-last-minute'),/!search.expandedRegion && !matchesSearchLocation/);
  assert.match(read('home-live-deals'),/const orderedDeals = scope \? data\?\.deals/);
  assert.match(read('home-live-deals'),/orderedDeals.filter\(deal => eligibleDealDate\(deal.from, clock.now\)\)/);
});
test('regional rails span the whole results grid on desktop rather than one property cell',()=>{
  const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
  assert.match(css,/\.regional-availability \{ min-width: 0; grid-column: 1 \/ -1; \}/);
});
test('event result-list geometry never leaks into nested rail articles and clips price/actions',()=>{
  const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/\.event-list article/);
  assert.match(css,/\.event-list > article \{ display: grid; grid-template-columns: 280px 1fr;/);
});
