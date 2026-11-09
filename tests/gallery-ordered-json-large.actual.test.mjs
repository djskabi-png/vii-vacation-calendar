import assert from 'node:assert/strict';
import test from 'node:test';
import {parseOrderedJson,orderedObjectEntries,stringifyOrderedJson} from '../app/lib/supplier-gallery-contract.ts';

test('large API-shaped catalogs retain numeric gallery wire order beyond the old token ceiling',()=>{
 const rows=Array.from({length:45000},(_,i)=>({id:i,title:'API-owned',images:['one.jpg','two.jpg']}));
 const wire='{"galleries":{"9":{"pictures":["nine.jpg"]},"2":{"pictures":["two.jpg"]}},"places":'+JSON.stringify(rows)+'}';
 const before=performance.now();const parsed=parseOrderedJson(wire);
 assert.equal(parsed.places.length,45000);
 assert.deepEqual(orderedObjectEntries(parsed.galleries).map(([key])=>key),['9','2']);
 assert.equal(Object.getPrototypeOf(parsed),null);
 assert.equal(Object.getPrototypeOf(parsed.places[44999]),null);
 assert.deepEqual(parsed.places[44999].images,['one.jpg','two.jpg']);
 console.log(JSON.stringify({largeOrderedParserBytes:Buffer.byteLength(wire),rows:45000,elapsedMs:Math.round(performance.now()-before)}));
});
test('single-allocation scanner preserves strict JSON, duplicate-key, prototype, depth and work bounds',()=>{
 for(const wire of ['{"x":1,"x":2}','{"x":[1],"x":2}','{"a":1,"\\u0061":2}'])assert.throws(()=>parseOrderedJson(wire),/duplicate/);
 for(const wire of ['{"x":01}','{"x":1,}','\u00a0{"x":1}','{"x":"raw\u0001"}'])assert.throws(()=>parseOrderedJson(wire),/invalid/);
 assert.throws(()=>parseOrderedJson('{"x":[[[1]]]}',1000,2),/deep/);
 assert.throws(()=>parseOrderedJson('{"x":[1,2,3]}',1000,32,3),/many_nodes/);
 assert.throws(()=>parseOrderedJson('"abcdefgh"',4),/too_large/);
 const p=parseOrderedJson('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
 assert.equal(Object.getPrototypeOf(p),null);assert.equal({}.polluted,undefined);
 assert.equal(p.__proto__.polluted,true);
});
test('narrowed contexts retain numeric gallery and package wire order through serialization',()=>{
 const original=parseOrderedJson('{"places":[{"siteID":1,"galleries":{"9":{"pictures":["nine.jpg"]},"2":{"pictures":["two.jpg"]}}},{"siteID":2,"galleries":[]}],"packages":{"7":{"id":7},"3":{"id":3}}}');
 const narrowed={...original,places:original.places.filter(p=>p.siteID===1)};
 const roundtrip=parseOrderedJson(stringifyOrderedJson(narrowed));
 assert.equal(roundtrip.places.length,1);
 assert.deepEqual(orderedObjectEntries(roundtrip.places[0].galleries).map(([key])=>key),['9','2']);
 assert.deepEqual(orderedObjectEntries(roundtrip.packages).map(([key])=>key),['7','3']);
 assert.deepEqual(JSON.parse(stringifyOrderedJson(narrowed)),JSON.parse(JSON.stringify(narrowed)));
});
