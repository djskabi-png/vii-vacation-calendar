import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeBundledDetail} from '../app/lib/public-catalog-read.ts';
const stamp={checkedAt:'2026-11-05T12:00:00Z',attemptedAt:'2026-11-05T12:00:00Z'};
test('a fully verified accepted detail never resurrects deleted galleries, rooms or features from an older build',()=>{
 const accepted={name:'Place',_viiCatalog:stamp,images:['/api/vii/media/new.jpg'],galleryGroups:[],features:[],featureGroups:[],rooms:[]};
 const old={name:'Place',images:['/api/vii/media/old.jpg'],galleryGroups:[{title:'Removed gallery',images:['/api/vii/media/old.jpg']}],features:['Removed feature'],featureGroups:[{title:'Old',items:['Removed feature']}],rooms:[{id:4,images:['/api/vii/media/unit.jpg']}]};
 const result=mergeBundledDetail(accepted,old);assert.deepEqual(result,accepted);assert.equal(result.rooms.length,0);assert.equal(result.galleryGroups.length,0);
});
test('legacy presentation hydration never borrows another unit by position or duplicate name',()=>{
 const accepted={rooms:[{id:9,name:'Suite',images:[],features:[]}]};
 const old={rooms:[{id:7,name:'Suite',images:['/api/vii/media/other-unit.jpg'],features:['Other unit feature']}]};
 const result=mergeBundledDetail(accepted,old);assert.deepEqual(result.rooms,accepted.rooms);
});
test('a failed refresh retains the last fully verified authoritative detail and cannot revive old media',()=>{
 const accepted={_viiCatalog:{...stamp,attemptedAt:'2026-11-05T13:00:00Z',retryAfter:'2026-11-05T19:00:00Z'},images:[],rooms:[{id:7,images:[],features:[]}]};
 assert.deepEqual(mergeBundledDetail(accepted,{images:['/api/vii/media/old.jpg'],rooms:[{id:7,images:['/api/vii/media/old-unit.jpg'],features:['Old']}]}),accepted);
});

test('missing, malformed and future private timestamps never suppress legacy presentation hydration',()=>{
 const old={rooms:[{id:7,images:['/api/vii/media/same-unit.jpg']}]};
 for(const meta of [undefined,{checkedAt:'invalid',attemptedAt:'invalid'},{checkedAt:stamp.checkedAt},{checkedAt:'2999-01-01T00:00:00Z',attemptedAt:'2999-01-01T00:00:00Z'},{checkedAt:stamp.checkedAt,attemptedAt:'2026-11-04T12:00:00Z'}]){
  const result=mergeBundledDetail({_viiCatalog:meta,rooms:[{id:7,images:[]}]},old);
  assert.deepEqual(result.rooms[0].images,old.rooms[0].images);
 }
});

test('a media-only refresh preserves exact current galleries without claiming full facts were refreshed',()=>{
 const accepted={_viiCatalog:{mediaCheckedAt:stamp.checkedAt,attemptedAt:stamp.attemptedAt},images:['/api/vii/media/current.jpg'],galleryGroups:[],features:[],rooms:[{id:7,images:[],galleryGroups:[],features:[]}]};
 const old={images:['/api/vii/media/removed.jpg'],galleryGroups:[{title:'Removed',images:['/api/vii/media/removed.jpg']}],features:['Legacy presentation'],rooms:[{id:7,images:['/api/vii/media/removed-unit.jpg'],galleryGroups:[{title:'Removed unit'}],features:['Legacy room fact']}]};
 const result=mergeBundledDetail(accepted,old);
 assert.deepEqual(result.images,accepted.images);assert.deepEqual(result.galleryGroups,[]);
 assert.deepEqual(result.rooms[0].images,[]);assert.deepEqual(result.rooms[0].galleryGroups,[]);
 assert.deepEqual(result.features,old.features);assert.deepEqual(result.rooms[0].features,old.rooms[0].features);
 assert.equal(result._viiCatalog.checkedAt,undefined);
 const empty=mergeBundledDetail({...accepted,rooms:[]},old);assert.deepEqual(empty.rooms,[]);
});

test('actual vacation 1296 DTO retains current room gallery and repairs a missing single-unit projection without bundle borrowing', async()=>{
 const captured=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('./fixtures/vacation-1296-public-detail-20261108.json',import.meta.url),'utf8'));
 const current=captured.detail;
 assert.equal(current.rooms[0].id,2409);
 assert.ok(current.rooms[0].images.length>0);
 assert.ok(current.rooms[0].features.includes('מיטה זוגית'));
 assert.ok(current.rooms[0].features.includes('ספה נפתחת'));
 const accepted={...current,_viiCatalog:{mediaCheckedAt:stamp.checkedAt,attemptedAt:stamp.attemptedAt},rooms:current.rooms.map(room=>({...room,images:[]}))};
 const bundled={images:['/api/vii/media/bundled-not-current.jpg'],rooms:[{id:2409,quantity:1,images:['/api/vii/media/bundled-unit.jpg'],features:['old']} ]};
 const result=mergeBundledDetail(accepted,bundled);
 assert.deepEqual(result.rooms[0].images,accepted.images);
 assert.deepEqual(result.rooms[0].features,current.rooms[0].features);
 assert.deepEqual(mergeBundledDetail(current,bundled).rooms[0].images,current.rooms[0].images);
 const cleared=mergeBundledDetail({...accepted,images:[]},bundled);
 assert.deepEqual(cleared.rooms[0].images,[]);
});

test('single-unit projection does not borrow place media for multi-unit quantity three',()=>{
 const result=mergeBundledDetail({images:['/api/vii/media/place.jpg'],units:3,rooms:[{id:2409,quantity:3,images:[]}]},{images:['/api/vii/media/old.jpg'],rooms:[{id:2409,quantity:3,images:[]}]});
 assert.deepEqual(result.rooms[0].images,[]);
});
