import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalLocationDestination} from '../app/lib/canonical-location-redirect.ts';
test('all four existing query-location routes normalize once and keep transactional state and origin',()=>{
 for(const [source,expected] of [['/search','/vacations/search/tel-aviv'],['/events/search','/events/search/tel-aviv'],['/spas','/spas/search/tel-aviv'],['/hourly','/hourly/search/tel-aviv']]){
  const input=new URL(source,'https://vii.spaplus.co');input.searchParams.set('location','תל אביב');input.searchParams.set('from','2026-11-26');input.searchParams.set('guests','4');input.searchParams.set('features','amenity-279');
  const target=canonicalLocationDestination(input);assert.equal(target.pathname,expected);assert.equal(target.origin,input.origin);assert.equal(target.searchParams.has('location'),false);assert.equal(target.searchParams.get('from'),'2026-11-26');assert.equal(target.searchParams.get('guests'),'4');assert.equal(target.searchParams.get('features'),'amenity-279');assert.equal(canonicalLocationDestination(target),null);
  assert.equal(input.searchParams.get('location'),'תל אביב','input remains immutable');
 }
});
test('unapproved locations, unrelated paths and the existing accommodation-type exception keep their query route',()=>{
 for(const path of ['/search?location=רעננה','/search?location=תל אביב&type=וילות','/search?location=תל אביב&types=וילות','/business?location=תל אביב','/events/search?location=לא מוכר'])assert.equal(canonicalLocationDestination(new URL(path,'https://vii.spaplus.co')),null,path);
});
