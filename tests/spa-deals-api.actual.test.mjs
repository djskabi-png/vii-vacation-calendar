import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceLoader} from './helpers/source-module-loader.mjs';
import {spaDealDays} from '../app/lib/spa-deal-window.ts';
import {eventDealDate} from '../app/lib/event-deal-dates.ts';
let status='verified';
const waits=[];
const sites=[{id:6,title:'Fixture',city:'תל אביב',image:'https://www.spaplus.co.il/gallery/fixture.jpg',packages:[{id:1,title:'single fixture',price:200,people:1},{id:2,title:'couple fixture',price:600,people:2}]}];
const load=createSourceLoader({
 '../../../lib/public-catalog-read.ts':{publicCatalogSummaries:async()=>sites},
 '../../../lib/spa-availability.ts':{readSpaAvailability:async()=>[]},
 '../../../lib/discovery-offer-cache.ts':{cachedDiscovery:async()=>null},
 '../../../lib/published-supplier-ids.ts':{runtimeCatalogDatabase:async()=>null},
 'vinext/shims/request-context':{getRequestExecutionContext:()=>({waitUntil:p=>waits.push(p)})},
 '../../../lib/spa-discovery-inputs.ts':{spaDiscoveryInputs:async()=>{if(status==='error')throw Error('fixture offline');return {sites,cached:status==='refreshing'?null:{value:spaDealDays().map(date=>({siteID:6,date,available:1})),cache:{status:'fresh',checkedAt:new Date().toISOString()}},refresh:Promise.resolve(),catalogMs:1,availabilityMs:1,elapsedMs:2};}}
});
const {GET}=load('app/api/spa/deals/route.ts');
test('actual SPA rail API returns exactly six supported dates and audience-specific offers',async()=>{
 status='verified';const response=await GET(new Request('https://fixture.test/api/spa/deals'));assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data.days,spaDealDays());assert.equal(data.days.length,6);assert.equal(Object.keys(data.offers).length,6);for(const date of data.days){assert.equal(data.offers[date].single[0].price,200);assert.equal(data.offers[date].couple[0].price,600);assert.deepEqual(data.offers[date].group,[]);}
});
test('actual full-page API accepts last supported date and rejects unsupported seventh day',async()=>{
 status='verified';const days=spaDealDays(),seventh=new Date(days.at(-1)+'T12:00:00Z');seventh.setUTCDate(seventh.getUTCDate()+1);
 for(const [date,expected]of [[days.at(-1),200],[seventh.toISOString().slice(0,10),400],[eventDealDate(0),200],['2026-02-30',400]]){
  const response=await GET(new Request('https://fixture.test/api/spa/deals?full=1&date='+date));assert.equal(response.status,expected,date);
 }
});
test('actual catalog-only and failed API responses never invent date availability',async()=>{
 status='refreshing';const response=await GET(new Request('https://fixture.test/api/spa/deals'));const data=await response.json();assert.equal(data.availabilityStatus,'refreshing');assert.ok(Object.values(data.offers).every(a=>Object.values(a).every(rows=>rows.length===0)));assert.equal(waits.length,1);
 status='error';const failure=await GET(new Request('https://fixture.test/api/spa/deals'));assert.equal(failure.status,503);assert.equal(failure.headers.get('Cache-Control'),'no-store');
});
