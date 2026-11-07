import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import ts from 'typescript'; import { eventCombinationHref, eventTypeSlugs } from "../app/data/world-search-landings.ts";
import { canonicalLegacyEventSearchPath } from '../app/lib/legacy-event-intent-index.ts';
import { normalizeEventVenueType } from '../app/lib/event-search-taxonomy.ts';
import { localizedPath } from '../app/i18n/locale-routing.ts';
test("event location/type combinations have stable unique canonical paths", () => {
  assert.equal(eventCombinationHref("צפון", "לופטים"), "/events/search/north/lofts");
  assert.equal(eventCombinationHref("דרום ונגב", "וילות"), "/events/search/south/villas");
  assert.notEqual(eventCombinationHref("צפון", "לופטים"), eventCombinationHref("צפון", "וילות"));
});
function regionRoute(locale = 'he') {
 const source = fs.readFileSync('app/events/search/[region]/page.tsx','utf8');
 const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const calls={catalog:0};
 const require=name=>{
  if(name==='next/navigation') return {redirect:target=>{throw {target}},notFound:()=>{throw Error('404')}};
  if(name==='next/headers') return {headers:async()=>new Headers({'x-vii-locale':locale})};
  if(name.includes('locale-routing')) return {localizedPath};
  if(name.includes('world-location-pages')) return {approvedWorldLocation:async()=>({label:'צפון'})};
  if(name.includes('world-search-landings')) return {eventCombinationHref,eventTypeSlugs,eventSearchHref:()=>'/events/search/north'};
  if(name.includes('legacy-event-intent-index'))return{canonicalLegacyEventSearchPath};
  if(name.includes('event-search-taxonomy'))return{normalizeEventVenueType};
  if(name.includes('public-catalog-read'))return{publicCatalogSummaries:async()=>{calls.catalog++;return[]}};
  if(name.includes('nearby-recommendations'))return{completePlaceSearchResults:x=>x,nearbySearchRecommendations:()=>[]};
  if(name.includes('search-page-content'))return{publishedSearchPage:async()=>null};
  if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'};
  return new Proxy({}, {get:()=>()=>({})});
 };
 const module={exports:{}};new Function('require','module','exports',code)(require,module,module.exports);
 return {run:query=>module.exports.default({params:Promise.resolve({region:'north'}),searchParams:Promise.resolve(query)}),calls};
}

test('actual legacy region route redirects a known type with dates, locale and duplicate query values preserved', async()=>{
 const route=regionRoute('en');
 await assert.rejects(route.run({type:'לופט',from:'2026-11-13',guests:'20',features:'amenity-7',tag:['first','second']}),error=>{
  const target=new URL(error.target,'https://fixture.invalid');assert.equal(target.pathname,'/en/events/search/north/lofts');assert.equal(target.searchParams.get('from'),'2026-11-13');assert.equal(target.searchParams.get('guests'),'20');assert.equal(target.searchParams.get('features'),'amenity-7');assert.deepEqual(target.searchParams.getAll('tag'),['first','second']);assert.equal(target.searchParams.has('type'),false);return true;
 });assert.equal(route.calls.catalog,0);
});
test('unknown venue type never redirects to itself',async()=>{
 const route=regionRoute();await route.run({type:'not-a-real-type'});assert.equal(route.calls.catalog,1);
});
test('an existing unfiltered region retains its200 page and submitted dates instead of redirecting', async()=>{
 const route=regionRoute();await route.run({from:'2026-11-13',guests:'80'});assert.equal(route.calls.catalog,1);
});
