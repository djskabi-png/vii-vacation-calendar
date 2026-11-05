import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectSergeyPublicCatalogValue as project } from '../app/lib/sergey-public-catalog-projection.ts';
import { publicVacationSearchProperties as compact } from '../app/lib/public-vacation-search.ts';
import { acceptedSergeySummaries } from '../app/lib/accepted-bundled-catalog.ts';
import { matchesVacationSearchFilter as matches } from '../app/lib/vacation-search-filter-index.ts';
import { filterIdsFromSupplierAmenityIds, filterIdsFromStructuredAmenityLabels } from '../app/lib/supplier-amenity-filters.ts';
import { buildSergeyAmenityIndex } from '../app/lib/sergey-amenities.ts';
import { catalogResponse } from '../app/api/catalog/route.ts';
const legacy=JSON.parse(readFileSync(new URL('../app/data/legacy-amenity-search-index.json',import.meta.url)));
const rows=acceptedSergeySummaries('vacations');

test('real2244 shared source facts survive bundled and repeated compact projections',async()=>{
 const man=rows.find(p=>p.slug==='vacation-2244'); assert.ok(man);
 for(const value of [man,...compact([man]),...compact(compact([man]))]) {
  for(const id of ['accessible','luxury','protected-space','wifi','covered-heated-pool','heated-pool','pool','amenity-62','amenity-348']) assert.equal(matches(value,id),true,id);
 }
 const api=await (await catalogResponse(new Request('https://vii.spaplus.co/api/catalog?world=vacations&view=search'),null)).json();
 const apiMan=api.entries.find(e=>e.supplierId===2244).summary;
 assert.equal(matches(apiMan,'accessible'),true);assert.equal(matches(apiMan,'luxury'),true);
});

test('every accepted legacy accessibility identity survives without silently dropping partial qualifications',()=>{
 for(const [slug,entry] of Object.entries(legacy.entries)) {
  const row=rows.find(p=>p.slug===slug); if(!row)continue;
  if(entry.ids.includes(62)) assert.equal(matches(row,'accessible'),true,slug);
 }
 for(const id of [2702,2527,1642]) {
  const entry=legacy.entries[`vacation-${id}`];
  assert.ok(entry.accessibility.some(x=>x.includes('חלקית')));
  assert.equal(matches(rows.find(p=>p.supplierId===id),'accessible'),true);
 }
});

test('explicit new index and explicit empty override legacy, description and old feature text',()=>{
 const old=rows.find(p=>p.slug==='vacation-2244');
 for(const ids of [[],['wifi']]) {
  const value=project({...old,searchFilterIds:ids});
  assert.deepEqual(value.searchFilterIds,ids);
  assert.equal(matches(value,'accessible'),false);
  assert.deepEqual(compact([value])[0].searchFilterIds,ids);
 }
 assert.deepEqual(project({...old,searchFilterIds:['amenity-9001']}).searchFilterIds,['amenity-9001']);
});

test('backfill is vacation-only and requires exact source identity',()=>{
 for(const value of [
  {slug:'event-2244',world:'events'}, {slug:'vacation-2244',world:'events'},
  {slug:'vacation-2244',world:'rooms'}, {slug:'vacation-2244',supplierId:1},
  {slug:'vacation-02244'}, {slug:'vacation-9999999'},
 ]) assert.equal(project(value).searchFilterIds,undefined,JSON.stringify(value));
});

test('numeric supplier identities include unknown IDs and bounded parent chains; aliases require matching labels',()=>{
 const index=buildSergeyAmenityIndex({amenities:[{id:62,title:'נגישות לנכים'},{id:9001,title:'רמפה',parentID:62},{id:9002,title:'בדיקה',parentID:9002},{id:348,title:'מאפיין אחר'}]});
 const ids=filterIdsFromSupplierAmenityIds([{id:9001},{id:9002},{id:348},{id:9876}],index);
 for(const id of ['accessible','amenity-62','amenity-9001','amenity-9002','amenity-9876'])assert.ok(ids.includes(id),id);
 assert.equal(ids.includes('luxury'),false);
 assert.deepEqual(filterIdsFromStructuredAmenityLabels(['לא נגיש לנכים','אין בריכה','לא מקבלים מסיבות']),[]);
});

test('generated backfill remains a bounded metadata index, never full profile payload',()=>{
 assert.equal(legacy.profileCount,573);
 assert.ok(Buffer.byteLength(JSON.stringify(legacy))<180000);
 for(const value of Object.values(legacy.entries)) assert.ok(Object.keys(value).every(k=>['ids','extra','accessibility'].includes(k)));
});
