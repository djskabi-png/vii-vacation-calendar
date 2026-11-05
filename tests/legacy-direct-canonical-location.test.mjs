import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyDisposition} from '../app/lib/legacy-route-map.ts';
test('observed Carmiel legacy search preserves its verified villa type and every dated party and price field without a city redirect',()=>{
 const source=new URL('https://www.vii.co.il/s?attr=277&roomTypes=4&sett=137&from=2026-11-26&till=2026-11-28&guests=2&children=1&rooms=1&minPrice=200&maxPrice=2000&sort=price-asc');
 const result=legacyDisposition(source);assert.equal(result.status,301);const target=new URL(result.target,source);
 assert.equal(target.pathname,'/search');assert.equal(target.searchParams.get('location'),'כרמיאל');assert.equal(target.searchParams.get('types'),'וילות');assert.equal(target.searchParams.get('pool'),'1');
 for(const key of ['from','till','guests','children','rooms','minPrice','maxPrice','sort'])assert.equal(target.searchParams.get(key),source.searchParams.get(key));
});
test('legacy hospitality-complex type remains selected while malformed type IDs are not guessed',()=>{
 const typed=new URL(legacyDisposition('/s?roomTypes=12&sett=133').target,'https://vii.spaplus.co');assert.equal(typed.searchParams.get('types'),'מתחמי אירוח');assert.equal(typed.searchParams.get('location'),'בנימינה');
 const unknown=new URL(legacyDisposition('/s?roomTypes=Array&sett=508').target,'https://vii.spaplus.co');assert.equal(unknown.searchParams.has('types'),false);assert.equal(unknown.pathname,'/vacations/search/givat-zeev');
});
test("observed Ra'anana legacy intent keeps the city even without an approved city landing",()=>{
 const result=legacyDisposition('/s?attr=277&sett=1244');const target=new URL(result.target,'https://vii.spaplus.co');assert.equal(target.searchParams.get('location'),'רעננה');assert.equal(target.searchParams.get('pool'),'1');
});
test('explicit verified legacy view amenity is not discarded on a generic city search',()=>{
 const result=legacyDisposition('/s?attr=279&sett=508');const target=new URL(result.target,'https://vii.spaplus.co');assert.equal(target.pathname,'/vacations/search/givat-zeev');assert.ok(target.searchParams.get('features')?.split(',').includes('amenity-279'));
});
