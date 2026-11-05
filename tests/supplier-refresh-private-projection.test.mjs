import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSergeyPublicCatalogValue} from '../app/lib/sergey-public-catalog-projection.ts';
test('public projection strips only private refresh bookkeeping at every place and room boundary without mutating accepted facts',()=>{
 const meta={checkedAt:'2026-11-05T12:00:00Z',retryAfter:'2026-11-05T18:00:00Z'};
 const source={supplierId:11,name:'Place',_viiCatalog:meta,detail:{description:'Retained description',_viiCatalog:meta,rooms:[{id:9,title:'Unit',area:42,_viiCatalog:meta}]}};
 const projected=projectSergeyPublicCatalogValue(source);
 assert.equal(projected._viiCatalog,undefined);assert.equal(projected.detail._viiCatalog,undefined);assert.equal(projected.detail.rooms[0]._viiCatalog,undefined);
 assert.equal(projected.detail.description,source.detail.description);assert.equal(projected.detail.rooms[0].area,42);assert.equal(projected.detail.rooms[0].id,9);
 assert.deepEqual(source._viiCatalog,meta);assert.deepEqual(source.detail.rooms[0]._viiCatalog,meta);
});
