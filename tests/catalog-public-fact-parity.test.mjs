import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {publicVacationSearchProperties} from '../app/lib/public-vacation-search.ts';
import {publicEventSearchPlaces} from '../app/lib/public-event-search.ts';
import {acceptedSergeyDetail,acceptedSergeySummaries} from '../app/lib/accepted-bundled-catalog.ts';
import details from '../app/data/sergey-place-details.json' with {type:'json'};
import {catalogResponse} from '../app/api/catalog/route.ts';
const compactSource={slug:'vacation-80000',name:'מקום',location:'ירושלים',area:'ירושלים',type:'סוויטה',guests:4,bedrooms:3,image:'/photo.jpg',images:['/photo.jpg'],features:[],description:'',audiences:[],badges:[],eventTypes:[],previewText:'טקסט מקדים מהספק',onlineAvailability:true,onlinePrices:true};
test('every compact catalog retains public preview,bedrooms and online calendar/price facts',()=>{
 for(const project of [publicVacationSearchProperties,publicEventSearchPlaces]){
  const [result]=project([compactSource]);
  for(const field of ['previewText','bedrooms','onlineAvailability','onlinePrices'])assert.equal(result[field],compactSource[field],field);
  const [unknown]=project([{...compactSource,onlineAvailability:undefined,onlinePrices:false}]);
  assert.equal(unknown.onlineAvailability,undefined);assert.equal(unknown.onlinePrices,false);
 }
});
const removed=[348,389,846,1887,2261,2493,2576];
async function wrappers(){
 const source=stripTypeScriptTypes((await readFile(new URL('../app/lib/public-catalog-read.ts',import.meta.url),'utf8')).replace(/^import .*;\r?$/gm,''));
 const fail=async()=>{throw Error('fixture_database_outage');};
 return new Function('sergeyDetails','acceptedSergeyDetail','acceptedSergeySummaries','publicCatalogDatabase','runtimeCatalogDatabase','readSupplierCatalogEntry','readSupplierCatalogState','projectSergeyPublicCatalogValue','readSupplierCatalogReviewPreviews',source.replace(/export /g,'')+';return {publicCatalogDetail,publicCatalogDetails,publicCatalogReviewDetails,publicCatalogReviewPreviews};')(details,acceptedSergeyDetail,acceptedSergeySummaries,fail,async()=>null,fail,fail,v=>v,fail);
}
test('all public detail/review fallback paths exclude7suppliers already removed from accepted build',async()=>{
 const f=await wrappers();
 for(const id of removed)assert.equal(await f.publicCatalogDetail('vacations',id),null,String(id));
 for(const method of ['publicCatalogDetails','publicCatalogReviewDetails','publicCatalogReviewPreviews']){
  const result=await f[method]('vacations',removed);
  for(const id of removed)assert.equal(result.get(id),null,`${method}:${id}`);
 }
 const allowed=acceptedSergeySummaries('vacations').find(p=>acceptedSergeyDetail('vacations',p.supplierId));
 assert.ok(allowed);assert.ok(await f.publicCatalogDetail('vacations',allowed.supplierId));
});
test('public catalog API fallback agrees with accepted manifest and cannot revive removed details',async()=>{
 const body=await (await catalogResponse(new Request('https://vii.spaplus.co/api/catalog?world=vacations'),null)).json();
 const wanted=new Set(acceptedSergeySummaries('vacations').map(p=>p.supplierId));
 assert.deepEqual(new Set(body.entries.map(e=>e.supplierId)),wanted);
 for(const id of removed){const r=await catalogResponse(new Request(`https://vii.spaplus.co/api/catalog?world=vacations&id=${id}`),null);assert.equal(r.status,404,String(id));}
});
