import test from "node:test";
import assert from "node:assert/strict";
import { cachedBusinessAmenities, cachedAmenityTaxonomy } from "../app/lib/business-amenities-cache.ts";
import { fetchLiveBusinessAmenities } from "../app/lib/live-business-amenities.ts";

test('accepted membership read failure and verified removal cannot return a cached place or call supplier',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('supplier must not be called');};
 await cachedBusinessAmenities({supplierId:2244,token:'fixture',fetchImpl,sourceRevision:'generation-current',load:async()=>({groups:[{title:'כללי',items:['נגישות לנכים']}],source:'biz-shared-amenities'})});
 const database=(mode)=>({prepare(sql){return {bind(){return this;},async first(){
  if(sql.includes('supplier_catalog_state'))return {activeRunId:'generation-current',activeCount:1};
  assert.ok(sql.includes('supplier_id = ? LIMIT 1'));
  if(mode==='failure')throw Error('membership_read_failed');return null;
 }};}});
 await assert.rejects(fetchLiveBusinessAmenities({supplierId:2244,token:'fixture',fetchImpl,database:database('failure')}),/membership_read_failed/);
 assert.deepEqual(await fetchLiveBusinessAmenities({supplierId:2244,token:'fixture',fetchImpl,database:database('removed')}),{groups:[],source:'biz-shared-amenities'});
 assert.equal(calls,0);
});

test('real types object uses the same cache path, isolates credentials and rejects malformed refresh without erasure',async()=>{
 let now=0,calls=0,malformed=false;
 const fetchImpl=async()=>{calls++;return Response.json(malformed?{amenities:[null],amenity_categories:[]}:{amenities:[{id:62,title:'נגישות לנכים',privateContact:{phone:'must-not-persist'}}],amenity_categories:[],roomTypes:[]});};
 const options=()=>({token:'fixture-taxonomy-A',fetchImpl,now:()=>now});
 const first=await cachedAmenityTaxonomy(options());
 assert.deepEqual(first.value,{amenities:[{id:62,title:'נגישות לנכים'}],amenity_categories:[],roomTypes:[]});
 await cachedAmenityTaxonomy(options());assert.equal(calls,1);
 await cachedAmenityTaxonomy({...options(),token:'fixture-taxonomy-B'});assert.equal(calls,2);
 now=8*86400000;malformed=true;
 const stale=await cachedAmenityTaxonomy(options());assert.equal(stale.cache.status,'stale');assert.deepEqual(stale.value,first.value);
 now=31*86400000;await assert.rejects(cachedAmenityTaxonomy(options()),/discovery_unavailable/);
});

test('an accepted full detail suppresses old migrated groups when the new shared facts are empty',async()=>{
 const fetchImpl=async url=>Response.json(url.endsWith('/types')?{amenities:[],amenity_categories:[]}:url.endsWith('/vacations')?{places:[]}:{id:2244,active:true,shared_amenities:[]});
 const database={prepare(sql){return {bind(){return this;},async first(){
  if(sql.includes('supplier_catalog_state'))return {activeRunId:'canonical-empty-regression',activeCount:1};
  if(sql.includes('supplier_catalog_entries'))return {supplier_id:2244,checkedAt:'2026-11-01T12:00:00Z',attemptedAt:'2026-11-01T12:00:00Z'};
  return null;
 }};}};
 assert.deepEqual(await fetchLiveBusinessAmenities({supplierId:2244,token:'canonical-empty',fetchImpl,database}),{groups:[],source:'biz-shared-amenities'});
});

test('a search filter index alone cannot erase migrated shared-place groups after partial detail',async()=>{
 const fetchImpl=async url=>Response.json(url.endsWith('/types')?{amenities:[],amenity_categories:[]}:url.endsWith('/vacations')?{places:[]}:{id:2483,active:true,shared_amenities:[]});
 const database={prepare(sql){return {bind(){return this;},async first(){return sql.includes('supplier_catalog_state')?{activeRunId:'partial-groups-2483',activeCount:1}:sql.includes('supplier_catalog_entries')?{supplier_id:2483,filterIndexType:'array'}:null;}};}};
 const result=await fetchLiveBusinessAmenities({supplierId:2483,token:'partial-index',fetchImpl,database});
 assert.equal(result.source,'migrated-vii-place-amenities');assert.ok(result.groups.some(group=>group.title==='מתחם חיצוני'));assert.ok(result.groups.some(group=>group.title==='מתחם פנימי'));
});

test('actual business loader shares types and list between places and an authoritative inactive refresh clears old facts',async()=>{
 let now=0,inactive=false;const calls={detail:0,types:0,list:0};
 const fetchImpl=async url=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/types')){calls.types++;return Response.json({amenities:[{id:62,title:'נגישות לנכים',categoryID:1}],amenity_categories:[{categoryID:1,categoryName:'כללי'}]});}
  if(path.endsWith('/vacations')){calls.list++;return Response.json({places:[910001,910002].map(siteID=>({siteID,shared_amenities:[62],contact:{private:'discard'}}))});}
  calls.detail++;return Response.json({id:Number(path.split('/').at(-1)),active:!inactive,shared_amenities:[]});
 };
 const options=id=>({supplierId:id,token:'fixture-list',fetchImpl,database:null,sourceRevision:'accepted-A',now:()=>now});
 for(const id of [910001,910002])assert.deepEqual((await fetchLiveBusinessAmenities(options(id))).groups,[{title:'כללי',items:['נגישות לנכים']}]);
 assert.deepEqual(calls,{detail:2,types:1,list:1});
 now=8*86400000;inactive=true;
 assert.deepEqual((await fetchLiveBusinessAmenities(options(910001))).groups,[]);
 assert.deepEqual((await fetchLiveBusinessAmenities(options(910001))).groups,[]);
 assert.deepEqual(calls,{detail:3,types:1,list:1});
});

test("business amenity cache coalesces concurrent production loads and preserves empty groups", async () => {
  let calls = 0;
  const load = async () => { calls += 1; await new Promise(resolve => setTimeout(resolve, 10)); return { groups: [], source: "biz-shared-amenities" }; };
  const values = await Promise.all([
    cachedBusinessAmenities({ supplierId: 990001, token: "token", load }),
    cachedBusinessAmenities({ supplierId: 990001, token: "token", load }),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(values[0].value.groups, []);
  assert.deepEqual(values[1].value.groups, []);
});

test("injected fetch/load paths do not share process cache state between fixtures", async () => {
  let first = 0;
  let second = 0;
  const fetchA = Object.assign(async () => new Response("{}"), {});
  const fetchB = Object.assign(async () => new Response("{}"), {});
  const a = await cachedBusinessAmenities({ supplierId: 990002, token: "token", fetchImpl: fetchA, load: async () => { first += 1; return { groups: [{ title: "A", items: ["x"] }], source: "biz-shared-amenities" }; } });
  const b = await cachedBusinessAmenities({ supplierId: 990002, token: "token", fetchImpl: fetchB, load: async () => { second += 1; return { groups: [{ title: "B", items: ["y"] }], source: "biz-shared-amenities" }; } });
  assert.equal(first, 1);
  assert.equal(second, 1);
  assert.equal(a.value.groups[0].title, "A");
  assert.equal(b.value.groups[0].title, "B");
});

test("source revision changes invalidate a place snapshot and malformed taxonomy fails closed", async () => {
  let calls = 0;
  const fetcher = async () => new Response(JSON.stringify({ amenities: [], amenity_categories: [] }), { status: 200 });
  const load = async () => ({ groups: [{ title: String(++calls), items: ["x"] }], source: "biz-shared-amenities" });
  const first = await cachedBusinessAmenities({ supplierId: 990003, token: "token", sourceRevision: "r1", fetchImpl: fetcher, load });
  const second = await cachedBusinessAmenities({ supplierId: 990003, token: "token", sourceRevision: "r2", fetchImpl: fetcher, load });
  assert.equal(first.value.groups[0].title, "1");
  assert.equal(second.value.groups[0].title, "2");
  const malformed = async () => new Response(JSON.stringify([]), { status: 200 });
  await assert.rejects(() => cachedAmenityTaxonomy({ token: "token", fetchImpl: malformed }), /discovery_unavailable/);
});

test("seven-day refresh serves stale during provider failure and expires after thirty days", async () => {
  let now = 0; let calls = 0; let fail = false;
  const load = async () => { calls += 1; if (fail) throw new Error("offline"); return { groups: [{ title: "stable", items: ["x"] }], source: "biz-shared-amenities" }; };
  const opts = () => ({ supplierId: 990004, token: "token", now: () => now, load });
  const first = await cachedBusinessAmenities(opts());
  assert.equal(first.value.groups[0].title, "stable");
  now = 8 * 86_400_000; fail = true;
  const stale = await cachedBusinessAmenities(opts());
  assert.equal(stale.value.groups[0].title, "stable");
  now = 31 * 86_400_000;
  await assert.rejects(() => cachedBusinessAmenities(opts()), /discovery_unavailable/);
  assert.ok(calls >= 2);
});
