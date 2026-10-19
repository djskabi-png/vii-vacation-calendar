import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {spaSearchStateFromValues,spaSearchHref,spaSearchTitle,spaItemMatchesSearch} from '../app/data/spa-search-landings.ts';
import {vacationRegionByLabel,cleanVacationPath} from '../app/data/vacation-landings.ts';
import {eventSearchHref,hourlySearchHref,searchLocationFromSlug} from '../app/data/world-search-landings.ts';
import {regionalAvailabilityRegion,selectRegionalOffers} from '../app/lib/regional-availability.ts';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('equivalent scopes use one clean route per world without dropping selection',()=>{
 for(const label of ['גוש דן','תל אביב והסביבה','תל אביב וגוש דן']){
  assert.equal(spaSearchHref(spaSearchStateFromValues(label)), '/spas/search/tel-aviv-area');
  assert.equal(cleanVacationPath(label),'/vacations/tel-aviv-area');
  assert.equal(eventSearchHref(label),'/events/search/tel-aviv-area');
  assert.equal(hourlySearchHref(label),'/hourly/search/tel-aviv-area');
  assert.equal(regionalAvailabilityRegion(label)?.label,'תל אביב וגוש דן');
 }
 for(const label of ['חיפה והסביבה','חיפה וחוף הכרמל','חיפה והכרמל']){
  assert.equal(spaSearchHref(spaSearchStateFromValues(label)), '/spas/search/haifa-carmel');
  assert.equal(cleanVacationPath(label),'/vacations/haifa-carmel');
  assert.equal(eventSearchHref(label),'/events/search/haifa-carmel');
  assert.equal(hourlySearchHref(label),'/hourly/search/haifa-carmel');
 }
 assert.equal(vacationRegionByLabel('תל אביב').slug,'tel-aviv');
 assert.equal(searchLocationFromSlug('events','tel-aviv-area'),'תל אביב וגוש דן');
});
test('new metro titles are localized and retain audience and feature constraints',()=>{
 const state=spaSearchStateFromValues('גוש דן','couple',['pool']);
 for(const language of ['en','fr','ru']) assert.doesNotMatch(spaSearchTitle(state,language),/[\u0590-\u05ff]|undefined/);
 const spa={id:'spa-1',location:'רמת גן',area:'מרכז',features:['חבילות זוגיות'],name:'Place',description:'בריכה',world:'spa'};
 assert.equal(spaItemMatchesSearch(spa,state),true);
 assert.equal(spaItemMatchesSearch({...spa,features:['חבילות ליחיד']},state),false);
 assert.equal(spaItemMatchesSearch({...spa,description:'ללא מתקנים'},state),false);
});
test('regional sliders choose local metro offers before nearby and never invent a place',()=>{
 const places=[{supplierId:1,location:'תל אביב',area:'מרכז',lat:32.08,lng:34.78},{supplierId:2,location:'בת ים',area:'מישור החוף והשפלה',lat:32.0,lng:34.75},{supplierId:3,location:'גבעתיים',area:'מישור החוף והשפלה',lat:32.07,lng:34.81},{supplierId:4,location:'אילת',lat:29.5,lng:34.9}];
 const offers=[{id:4},{id:2},{id:1},{id:3},{id:999}];
 const result=selectRegionalOffers(offers,places,'גוש דן',{placeId:x=>x.id,key:x=>String(x.id)});
 assert.deepEqual(result.offers.map(x=>x.id),[2,1,3]);
 assert.equal(result.expanded,false);
});
test('spa UI and shared picker use the canonical boundary, preserve non-geographic hardfilters',()=>{
 const ui=read('app/components/world-map-results.tsx');
 assert.match(ui,/matchesSearchLocation\(item, location\)/);
 assert.doesNotMatch(ui,/item\.area === location \|\| item\.location === location/);
 assert.match(ui,/selectedFilters\.every/);
 assert.match(ui,/availability\.sites\.has/);
 assert.match(read('app/components/search-box.tsx'),/destinationInventory\(managedGeography/);
 assert.match(read('app/components/search-box.tsx'),/matchingDestinations\(destinations, locationQuery, translate\)/);
});
