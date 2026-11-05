import test from 'node:test';import assert from 'node:assert/strict';
import inventory from '../app/data/legacy-redirect-inventory.json' with {type:'json'};
import {canonicalGeneratedLegacyTarget} from '../scripts/lib/legacy-generated-target.mjs';
test('all stored legacy targets are already normalized by the reusable generator policy',()=>{
 assert.equal(Object.keys(inventory.redirects).length,3149);
 for(const[source,target]of Object.entries(inventory.redirects))assert.equal(canonicalGeneratedLegacyTarget(source,target),target,source);
});
test('an existing approved villa/pool page is used directly without dropping transactional state',()=>{
 const target=canonicalGeneratedLegacyTarget('/s?attr=277&roomTypes=4&sett=66&from=2026-11-26&till=2026-11-28&guests=4','/search?location=הרצליה&pool=1');
 const url=new URL(target,'https://vii.spaplus.co');assert.equal(url.pathname,'/search/vacations/herzliya-95773-3d742a40');assert.equal(url.searchParams.get('from'),'2026-11-26');assert.equal(url.searchParams.get('till'),'2026-11-28');assert.equal(url.searchParams.get('guests'),'4');
});
