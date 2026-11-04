import assert from 'node:assert/strict';
import test from 'node:test';
import catalog from '../app/data/spaplus-public-catalog.json' with {type:'json'};
import evidence from '../app/data/spa-coordinate-evidence.json' with {type:'json'};
import index from '../app/data/spa-map-locations.json' with {type:'json'};
import {verifiedSpaMapLocation} from '../app/lib/spa-map-location.ts';
import {officialSpaIdentity,officialSpaCoordinate} from '../scripts/verify-spa-coordinate-identity.mjs';

test('source proof requires the main site id and an explicit business pin rather than a map camera',()=>{
 assert.equal(officialSpaIdentity('<input name="siteid" value="6">'),'6');
 assert.deepEqual(officialSpaCoordinate('https://maps.google.com/maps?q=32.065362,34.7639802'),{lat:32.065362,lng:34.7639802});
 assert.deepEqual(officialSpaCoordinate('!3d32.065362!4d34.7639802'),{lat:32.065362,lng:34.7639802});
 assert.equal(officialSpaCoordinate('!2d34.7639802!3d32.065362'),null);
 for(const row of evidence.verified)assert.equal(row.identity.siteIdMatch,true);
});

test('every exact spa backfill retains its official identity, address, city and source coordinate',()=>{
 assert.equal(evidence.verified.length+evidence.missing.length,catalog.sites.length);
 assert.equal(Object.keys(index).length,evidence.verified.length);
 for(const row of evidence.verified){const site=catalog.sites.find(s=>s.id===row.id);assert.ok(site,row.id);assert.equal(site.address,row.address || '');assert.equal(site.city,row.city || '');assert.equal(new URL(row.sourceUrl).hostname,'www.spaplus.co.il');const point=verifiedSpaMapLocation(site);if(!site.address.trim()){assert.equal(point,null,'a mobile service without a fixed address is not an exact physical spa pin');continue;}assert.equal(point.precision,'exact');assert.equal(point.lat,row.lat);assert.equal(point.lng,row.lng);assert.ok(point.lat>=29&&point.lat<=34&&point.lng>=34&&point.lng<=36);}
});
test('a moved business cannot reuse the old exact pin; supplier points win and unresolved records stay unresolved',()=>{
 const site=catalog.sites.find(s=>s.id===6);assert.deepEqual(verifiedSpaMapLocation(site),{lat:32.065362,lng:34.7639802,precision:'exact'});
 assert.equal(verifiedSpaMapLocation({...site,address:'כתובת חדשה'}),null);assert.equal(verifiedSpaMapLocation({...site,city:'ירושלים'}),null);
 assert.deepEqual(verifiedSpaMapLocation({...site,lat:31.78,lng:35.22}),{lat:31.78,lng:35.22,precision:'exact'});
 for(const row of evidence.missing)assert.equal(verifiedSpaMapLocation(catalog.sites.find(s=>s.id===row.id)),null);
});
