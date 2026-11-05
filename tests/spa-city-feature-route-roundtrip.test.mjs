import test from 'node:test';
import assert from 'node:assert/strict';
import approved from '../app/data/approved-world-locations.json' with {type:'json'};
import {spaLandings} from '../app/data/spa-landings.ts';
import {spaSearchAudiences,spaSearchStateFromValues,spaSearchHref,spaSearchStateFromSegments,spaSearchTitle} from '../app/data/spa-search-landings.ts';

test('every approved SPA location, audience and feature generates a route the parser accepts',()=>{
 for(const location of approved.spa)for(const audience of spaSearchAudiences)for(const feature of spaLandings){
  const state=spaSearchStateFromValues(location,audience.id,[feature.id]);const path=spaSearchHref(state);
  const parsed=spaSearchStateFromSegments(path.split('/').slice(3));
  assert.ok(parsed,path);assert.equal(parsed.region?.label,state.region?.label,path);
  assert.equal(parsed.audience?.id,audience.id,path);assert.deepEqual(parsed.features.map(x=>x.id),[feature.id],path);
  for(const lang of ['he','en','fr','ru']){const title=spaSearchTitle(parsed,lang);assert.equal(title.includes('undefined'),false,`${lang}:${path}`);if(lang!=='he')assert.equal(/[א-ת]/.test(title),false,`${lang}:${path}`);}
 }
});

test('observed public404 city combinations and former whole-country alias retain all facets',()=>{
 const paths=[
 '/fr/spas/search/nahariya/spa-day-pass/couples-spa/hotel-spa/spa-day/spa-with-pool/boutique-spa/spa-with-meal/spa-with-sauna',
 '/fr/spas/search/safed/spa-day-pass/couples-spa/hotel-spa/spa-day/spa-with-pool/boutique-spa/spa-with-meal/spa-with-sauna',
 '/fr/spas/search/tiberias/spa-day-pass/couples-spa/hotel-spa/spa-day/spa-with-pool/boutique-spa/spa-with-meal/spa-with-sauna',
 '/spas/search/city-kl-harz-1f7vp/spa-day-pass/couples-spa/spa-with-sauna/hotel-spa/spa-day/spa-with-meal/boutique-spa/spa-with-pool',
 '/spas/search/nahariya/couples/spa-with-jacuzzi/hotel-spa/spa-with-sauna/boutique-spa/couples-spa/spa-with-pool/spa-with-meal',
 '/spas/search/dead-sea/couples/boutique-spa/spa-with-pool/couples-spa/spa-with-sauna/spa-with-jacuzzi/spa-with-meal/spa-day',
 '/spas/search/ashkelon/spa-day-pass/couples-spa/spa-with-sauna/spa-with-gym/spa-day/spa-with-meal/spa-with-jacuzzi/hotel-spa',
 '/spas/search/ashdod/spa-day-pass/spa-with-jacuzzi/spa-with-sauna/boutique-spa/spa-with-meal/spa-day/hotel-spa/spa-with-gym/couples-spa',
 '/spas/search/city-ayn-gdy-yb6gc/spa-day-pass/spa-with-pool/couples-spa/hotel-spa/spa-with-jacuzzi/spa-day/spa-with-gym/boutique-spa/spa-with-meal',
 ];
 for(const path of paths){const parts=path.split('/');const segments=parts.slice(parts.indexOf('search')+1);const parsed=spaSearchStateFromSegments(segments);assert.ok(parsed,path);assert.ok(parsed.features.length>=7,path);assert.ok(parsed.audience,path);assert.equal(spaSearchStateFromSegments(spaSearchHref(parsed).split('/').slice(3))!==null,true,path);}
});

test('unknown slugs, duplicate facets and unsupported combinations still fail closed',()=>{
 for(const segments of [['invented-city','couples'],['north','south'],['north','spa-with-pool','spa-with-pool'],['nahariya','unknown-facility']])assert.equal(spaSearchStateFromSegments(segments),null,segments.join('/'));
 const city={slug:'new-verified-city',label:'עיר מאומתת'};
 assert.equal(spaSearchStateFromSegments(['new-verified-city','couples']),null);
 assert.equal(spaSearchStateFromSegments(['new-verified-city','couples'],city)?.region?.label,city.label);
});
