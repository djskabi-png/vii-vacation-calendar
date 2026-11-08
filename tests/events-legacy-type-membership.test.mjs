import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { matchesEventVenueType, matchesEventSearchLocation } from "../app/lib/event-search-taxonomy.ts";
import { projectSergeyPublicCatalogValue } from "../app/lib/sergey-public-catalog-projection.ts";
import { publicEventSearchPlaces } from "../app/lib/public-event-search.ts";

const legacy = JSON.parse(fs.readFileSync(new URL("./fixtures/events-center-lofts-parity-20261108.json", import.meta.url), "utf8"));
test("legacy center loft membership keeps every approved result", () => {
  const matched = legacy.entries.filter(place=>matchesEventVenueType(place,'לופטים')&&matchesEventSearchLocation(place,'מרכז')).map(place=>place.supplierId).sort((a,b)=>a-b);
  assert.deepEqual(legacy.expectedIds.filter(id=>!matched.includes(id)), []);
  // Both additional rows have current explicit supplier loft classifications.
  // Exact old-count equality would incorrectly remove current API inventory.
  assert.deepEqual(matched.filter(id=>!legacy.expectedIds.includes(id)), [1886,2037]);
  for(const id of [1886,2037]) assert.equal(legacy.entries.find(p=>p.supplierId===id).type,'לופט');
});
test('secondary loft membership works countrywide and keeps precise city boundaries',()=>{
  const venue=legacy.entries.find(place=>place.supplierId===1261);
  assert.equal(matchesEventVenueType(venue,'לופט'),true);
  assert.equal(matchesEventSearchLocation(venue,'הכל'),true);
  assert.equal(matchesEventSearchLocation(venue,'מרכז'),true);
  assert.equal(matchesEventSearchLocation(venue,'טבריה'),false);
  assert.equal(matchesEventSearchLocation(venue,'צפון'),false);
});
test('new current lofts and nonlegacy types remain searchable',()=>{
  const place={supplierId:99999,slug:'event-99999',type:'לופט',area:'מרכז',location:'תל אביב'};
  assert.equal(matchesEventVenueType(place,'לופטים'),true);
  assert.equal(matchesEventSearchLocation(place,'תל אביב'),true);
  assert.equal(matchesEventVenueType({...place,type:'וילה'},'לופטים'),false);
  assert.equal(matchesEventVenueType({...place,type:'וילה'},'וילות'),true);
});
test('accepted API projection and slim search payload retain both current and maintained types',()=>{
  const source={...legacy.entries.find(place=>place.supplierId===1261),name:'Verified venue',images:[],image:'',features:[],audiences:[],eventTypes:[],description:'',guests:20,scenario:'single'};
  const projected=projectSergeyPublicCatalogValue(source);
  assert.equal(projected.type,source.type);
  assert.ok(projected.types.includes('לופטים'));
  assert.equal(matchesEventVenueType(publicEventSearchPlaces([projected])[0],'לופטים'),true);
});
