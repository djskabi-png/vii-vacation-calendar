import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectSupplierCatalogWorld } from "../app/lib/supplier-catalog-runtime.ts";

function dbFixture(entries = [{supplierId:1,summary:{name:'Old'},detail:{rooms:[]}}]) {
  const writes = [];
  return { writes, prepare(sql) {
    return { bind(...args) { this.args = args; return this; }, async first() {
      return sql.includes("supplier_catalog_state") ? { activeRunId: "accepted", activeCount: entries.length, acceptedAt: "2026-11-05" } : null;
    }, async all() { return { results: sql.includes("supplier_catalog_entries") ? entries.map(entry=>({supplierId:entry.supplierId,summaryJson:JSON.stringify(entry.summary),detailJson:JSON.stringify(entry.detail)})) : [] }; },
      async run() { writes.push(sql); return {}; } };
  } };
}

test("candidate inspection compares without writing and bounds the public result", async () => {
  const db = dbFixture();
  const payloads = {
    "/locations": { cities: [{ id: 1, title: "חיפה", area: 2 }], areas: [{ id: 2, title: "חיפה והקריות" }] },
    "/vacations": { places: [{ active: true, siteID: 1, siteName: "New", location: { cityID: 1 }, galleries: [] }, { active: false, siteID: 2 }, { siteID: 3 }] },
    "/vacations/types": { amenities: [], amenity_categories: [] },
    "/vacations/1": { id: 1, active: true, name: "New", location: { city: 1 }, rooms: [], galleries: { main: { title: "מקום", pictures: ["/gallery/fixture.jpg"] } } },
  };
  const result = await inspectSupplierCatalogWorld(db, "vacations", {
    apiKey: "fixture", fetchImpl: async (url) => { const path = new URL(url).pathname; const key = Object.keys(payloads).find((item) => path.endsWith(item)); return new Response(JSON.stringify(payloads[key]), { status: 200, headers: { "content-type": "application/json" } }); },
  });
  assert.equal(result.diff.before, 1);
  assert.equal(result.diff.candidate, 1);
  assert.equal(result.diff.changed, 1);
  assert.equal(db.writes.length, 0);
  assert.equal(Object.hasOwn(result, "detail"), false);
  assert.equal(JSON.stringify(result).includes("fixture.jpg"), false);
  assert.equal(result.diff.removalWithinGuard, true);
  assert.deepEqual(result.sourceInventory.inactiveIds, [2]);
  assert.deepEqual(result.sourceInventory.unknownActivityIds, [3]);
});

test("provider failure during readonly inspection cannot write or replace accepted data",async()=>{
  const db=dbFixture();
  await assert.rejects(inspectSupplierCatalogWorld(db,"events",{apiKey:"fixture",fetchImpl:async()=>new Response(null,{status:503})}),/sergey_provider_error/);
  assert.equal(db.writes.length,0);
});

function provider(list,detailFor) {
  return async url=>{
    const path=new URL(url).pathname;
    const data=path.endsWith('/locations')?{cities:[{id:1,title:'Haifa',area:2}],areas:[{id:2,title:'North'}]}:
      path.endsWith('/types')?{amenities:[],amenity_categories:[]}:
      /\/events$/.test(path)?{places:list}:detailFor(Number(path.split('/').at(-1)));
    return Response.json(data);
  };
}
const active=id=>({siteID:id,siteName:'Fixture',active:true,location:{cityID:1},galleries:[]});
const detail=id=>({id,active:true,name:'Fixture',location:{city:1},rooms:[],galleries:{main:{title:'Main',pictures:['/gallery/p0.jpg']}}});

test('prior inactive IDs are intersected before bounding, and missing media exposes only bounded trusted filenames',async()=>{
  const removed=[210,225,342,727,2168,2508,2570];
  const db=dbFixture([{supplierId:1,summary:{name:'Fixture'},detail:{rooms:[],images:[...Array.from({length:14},(_,i)=>'/api/vii/media/p'+i+'.jpg'),'https://private.example/gallery/PRIVATE_TOKEN.jpg']}},
    ...[...removed,99001].map(supplierId=>({supplierId,summary:{name:'Fixture'},detail:{rooms:[]}}))]);
  const list=[active(1),...Array.from({length:110},(_,i)=>({siteID:10000+i,active:false})),...removed.map(siteID=>({siteID,active:false})),{siteID:99001}];
  const result=await inspectSupplierCatalogWorld(db,'events',{apiKey:'fixture',fetchImpl:provider(list,detail)});
  assert.equal(result.sourceInventory.inactiveIds.length,100);
  assert.equal(result.sourceInventory.inactiveIds.includes(2508),false);
  assert.deepEqual(result.sourceInventory.previousInactiveIds,removed);
  assert.deepEqual(result.sourceInventory.previousUnknownActivityIds,[99001]);
  assert.equal(result.sourceInventory.previousInactiveIdsTruncated,false);
  assert.equal(result.missingMediaEvidence[0].oldImageCount,15);
  assert.equal(result.missingMediaEvidence[0].newImageCount,1);
  assert.equal(result.missingMediaEvidence[0].removedTrustedFilenames.length,10);
  assert.equal(result.missingMediaEvidence[0].removedTrustedFilenamesTruncated,true);
  assert.doesNotMatch(JSON.stringify(result),/private\.example|PRIVATE_TOKEN/);
  assert.equal(db.writes.length,0);
});

test('media evidence is capped at ten businesses with an explicit total and truncation flag',async()=>{
  const ids=Array.from({length:12},(_,i)=>i+1);
  const db=dbFixture(ids.map(supplierId=>({supplierId,summary:{name:'Fixture'},detail:{rooms:[],images:['/api/vii/media/p0.jpg','/api/vii/media/removed.jpg']}})));
  const result=await inspectSupplierCatalogWorld(db,'events',{apiKey:'fixture',fetchImpl:provider(ids.map(active),detail)});
  assert.equal(result.missingMediaEvidence.length,10);
  assert.equal(result.missingMediaEvidenceTotal,12);
  assert.equal(result.missingMediaEvidenceTruncated,true);
  assert.equal(db.writes.length,0);
});

test('targeted administrator inspection fetches the chosen accepted detail and exposes only its safe proof code without writes',async()=>{
 const db=dbFixture([1,2].map(supplierId=>({supplierId,summary:{name:'Fixture'},detail:{rooms:[],images:['/api/vii/media/p0.jpg']}})));
 const reads=[];const fetchImpl=provider([active(1),active(2)],id=>{reads.push(id);return detail(id);});
 const result=await inspectSupplierCatalogWorld(db,'events',{apiKey:'fixture',supplierId:2,fetchImpl});
 assert.deepEqual(reads,[2]);assert.deepEqual(result.detailProofIssues,[{supplierId:2,code:'protocol_version'}]);assert.equal(db.writes.length,0);
 await assert.rejects(()=>inspectSupplierCatalogWorld(db,'events',{apiKey:'fixture',supplierId:999,fetchImpl}),/invalid_supplier_inspection/);
 assert.deepEqual(reads,[2]);assert.equal(db.writes.length,0);
});
