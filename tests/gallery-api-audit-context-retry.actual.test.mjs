import assert from "node:assert/strict";
import test from "node:test";
import { createGalleryAuditJob, readGalleryAuditJob, retryGalleryAuditSources, stepGalleryAuditJob } from "../app/lib/gallery-api-audit-job.ts";
import { createSergeyPublicCatalogClient } from "../app/lib/sergey-public-catalog-client.ts";
import { normalizeSpaPlusCatalog } from '../app/lib/spaplus-catalog-client.ts';

class Bucket {
  objects = new Map(); revision = 0;
  async get(key) { const value = this.objects.get(key); return value ? { etag: value.etag, size: value.text.length, customMetadata: value.customMetadata, text: async () => value.text } : null; }
  async put(key, text, options = {}) { const old = this.objects.get(key); if (options.onlyIf?.etagDoesNotMatch === "*" && old) return null; if (options.onlyIf?.etagMatches && old?.etag !== options.onlyIf.etagMatches) return null; const value = { text: String(text), etag: String(++this.revision), customMetadata: options.customMetadata }; this.objects.set(key, value); return { etag: value.etag }; }
}

const ids = { vacations: 17, events: 18, rooms: 19, spa: 20 };
const response = (value) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const context = (world) => world === "spa" ? { status: "ok", sites: { "20": { siteid: 20, title: "ספא" } } } : world === "vacations" || world === "events" ? { places: [{ siteID: ids[world], siteName: "מקום בדיקה", active: true, galleries: [{ galleryID: 9, title: "כללי", pictures: ["/gallery/place.jpg"] }], rooms: [{ roomID: 55 }] }] } : { places: [{ siteID: ids[world], siteName: "חדר", active: true, galleries: [{ galleryID: 9, title: "כללי", pictures: ["/gallery/place.jpg"] }], rooms: [{ roomID: 55 }] }] };
const detail = (id) => ({ id, active: true, api_version: 1.1, created: new Date().toISOString(), name: "מקום בדיקה", location: { city: 1 }, summary: "תיאור המקום", shared_amenities: [], galleries: { "9": { galleryID: 9, title: "כללי", pictures: ["/gallery/place.jpg"] } }, rooms: [{ roomID: 55, roomName: "יחידה", roomCount: 1, maxGuests: 2, amenities: [], spaces: [], galleries: [{ galleryID: 2, title: "יחידה", pictures: ["/gallery/unit.jpg"] }] }] });

test("retry repairs only terminal SPA context failure and remains idempotent", async () => {
  const calls = []; let spaAttempts = 0;
  const fetchImpl = async (input) => { const url = new URL(input); calls.push(url.href); if (url.hostname === "www.spaplus.co.il") { spaAttempts++; if (spaAttempts === 1) throw Error("provider_timeout"); return response(context("spa")); } const path = url.pathname.replace("/api/ai/vii", ""); if (path === "/locations" || path === "/rooms/locations") return response({ cities: [{id:1,title:'חיפה',area:2}], areas: [{id:2,title:'חיפה והקריות'}] }); if (path.endsWith("/types")) return response({ roomTypes: [], amenity_categories: [], amenities: [] }); if (path === "/vacations/17" || path === "/events/18" || path === "/rooms/19") return response(detail(ids[path.slice(1).split("/")[0]])); return response(context(path.slice(1)));
  };
  const accepted=(await createSergeyPublicCatalogClient({apiKey:'fixture',fetchImpl}).fetchCandidate('vacations')).entries[0];calls.length=0;
  const db = { prepare(sql) { return { bind(...args) { return { async first() { if (sql.includes("JOIN supplier_catalog_entries")) return { summaryJson: JSON.stringify(accepted.summary), detailJson: JSON.stringify(accepted.detail), acceptedAt: new Date().toISOString() }; const world = args[0]; return { activeRunId: `run-${world}`, activeCount: 1 }; }, async all() { return { results: [{ supplierId: ids[args[1]] }] }; } }; } }; } };
  const bucket = new Bucket(), jobId = "7edc4e9c-91a7-4f1b-b103-58796a14e781";
  await createGalleryAuditJob({ db, bucket, jobId, now: () => 1_000 });
  // Retain the original pre-per-world job recovery contract.
  const stored=bucket.objects.get(`vii-gallery-audit/v1/${jobId}/job.json`);const legacy=JSON.parse(stored.text);delete legacy.contextMode;delete legacy.contextWorlds;stored.text=JSON.stringify(legacy);
  const failed = await stepGalleryAuditJob({ db, bucket, jobId, batchSize: 1, env: { SERGEY_VII_API_TOKEN: "fixture", SPAPLUS_VII_API_KEY: "fixture" }, fetchImpl, now: () => 2_000 });
  assert.equal(failed.state, "error");
  assert.ok([...bucket.objects].some(([key]) => key.includes("context/") && key.endsWith(".json")));
  const before = calls.length;
  const retried = await retryGalleryAuditSources({ bucket, jobId, now: () => 3_000 });
  assert.equal(retried.sourceRetryUsed, true);
  const resumed = await stepGalleryAuditJob({ db, bucket, jobId, batchSize: 1, env: { SERGEY_VII_API_TOKEN: "fixture", SPAPLUS_VII_API_KEY: "fixture" }, fetchImpl, now: () => 4_000 });
  assert.ok(resumed.completed >= 1);
  assert.equal(resumed.matched,1);
  assert.equal(calls.filter(url=>new URL(url).pathname==='/api/ai/vii/locations').length,1);
  assert.equal(spaAttempts, 2);
  const callsAfter = calls.length;
  const second = await retryGalleryAuditSources({ bucket, jobId, now: () => 5_000 });
  assert.equal(second.sourceRetryUsed, true);
  assert.equal(second.state, resumed.state);
  assert.equal(second.cursor, resumed.cursor);
  assert.equal(second.completed, resumed.completed);
  assert.equal(calls.length, callsAfter);
  assert.ok(calls.length > before);
  assert.equal((await readGalleryAuditJob(bucket, jobId)).sourceIssues.length, 0);
});

test('retry refuses expired, uncertain, foreign-context and active-lease evidence, and never permits a third fetch',async()=>{
 const jobId='11111111-1111-4111-8111-111111111111',prefix=`vii-gallery-audit/v1/${jobId}/`;
 const base={jobId,state:'error',total:4,cursor:0,deadline:new Date(10000).toISOString(),createdAt:new Date(0).toISOString(),sourceIssues:['provider_context:spa:provider_timeout'],worldCounts:{vacations:1,events:1,rooms:1,spa:1},inventory:[],results:[],contextsReady:false};
 for(const [change,errorCode,expected] of [[{deadline:new Date(100).toISOString()},'provider_timeout',/deadline/],[{sourceIssues:['provider_context:vacations:provider_timeout']},'provider_timeout',/not_allowed/],[{},'context_fetch_uncertain',/not_allowed/],[{cursor:1},'provider_timeout',/not_allowed/],[{lease:{owner:'other',until:new Date(9000).toISOString()}},'provider_timeout',/in_progress/]]){
  const bucket=new Bucket();await bucket.put(prefix+'job.json',JSON.stringify({...base,...change}));await bucket.put(prefix+'context/spa.json.error',JSON.stringify({code:errorCode}));
  await assert.rejects(()=>retryGalleryAuditSources({bucket,jobId,now:()=>1000}),expected);
  assert.equal(bucket.objects.has(prefix+'context/spa.json.attempt-2'),false);
 }
 const bucket=new Bucket();await bucket.put(prefix+'job.json',JSON.stringify({...base,sourceRetryUsed:true}));let calls=0;
 assert.equal((await retryGalleryAuditSources({bucket,jobId,now:()=>1000})).state,'error');
 await stepGalleryAuditJob({bucket,db:{},jobId,now:()=>1000,env:{},fetchImpl:async()=>{calls++;throw Error('must_not_fetch')}});
 assert.equal(calls,0);
});

test('scoped SPA timeout retries once without fetching another world',async()=>{
 const payload={status:'ok',sites:{'20':{siteid:20,title:'ספא בדיקה',spa_picture:'https://www.spaplus.co.il/gallery/site.jpg',gallery:['https://www.spaplus.co.il/gallery/site.jpg'],packages:{'7':{MainPageID:7,idPack:8,price:200,MainPageTitle:'חבילה',pack_picture:'https://www.spaplus.co.il/gallery/pack.jpg'}}}}};
 const entry=normalizeSpaPlusCatalog(payload)[0],bucket=new Bucket(),jobId='99999999-9999-4999-8999-999999999999';
 const db={prepare(sql){return{bind(){return{first:async()=>sql.includes('JOIN supplier_catalog_entries')?{summaryJson:JSON.stringify(entry.summary),detailJson:entry.detail?JSON.stringify(entry.detail):null,acceptedAt:new Date().toISOString()}:{activeRunId:'spa-seed',activeCount:1},all:async()=>({results:[{supplierId:20}]})};}};}};
 let calls=0;const fetchImpl=async input=>{assert.equal(new URL(input).hostname,'www.spaplus.co.il');if(++calls===1)throw Error('provider_timeout');return response(payload);};
 await createGalleryAuditJob({db,bucket,jobId,scopeWorld:'spa'});
 const input={db,bucket,jobId,env:{SPAPLUS_VII_API_KEY:'fixture'},fetchImpl};
 assert.equal((await stepGalleryAuditJob(input)).state,'error');
 await retryGalleryAuditSources(input);const complete=await stepGalleryAuditJob(input);
 assert.equal(complete.state,'complete');assert.equal(complete.matched,1);assert.equal(complete.scopeWorld,'spa');assert.equal(calls,2);
 await retryGalleryAuditSources(input);await stepGalleryAuditJob(input);assert.equal(calls,2);
});

test('per-world SPA retry preserves an already completed immutable prefix',async()=>{
 const bucket=new Bucket(),jobId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',p='vii-gallery-audit/v1/'+jobId+'/';
 const results=[{world:'vacations',supplierId:17,status:'match',issues:[]}];
 const state={jobId,state:'error',contextMode:'per-world',contextWorlds:['vacations','events','rooms'],contextsReady:false,total:2,cursor:1,createdAt:new Date().toISOString(),deadline:new Date(Date.now()+3600000).toISOString(),sourceIssues:['provider_context:spa:provider_timeout'],worldCounts:{vacations:1,events:0,rooms:0,spa:1},inventory:[{world:'vacations',supplierId:17},{world:'spa',supplierId:20}],results};
 await bucket.put(p+'job.json',JSON.stringify(state));await bucket.put(p+'context/spa.json.error',JSON.stringify({code:'provider_timeout'}));await bucket.put(p+'raw/vacations-17.json','immutable-prefix');
 const result=await retryGalleryAuditSources({bucket,db:{},jobId});assert.equal(result.cursor,1);assert.equal(result.completed,1);assert.equal(result.sourceRetryUsed,true);
 const saved=JSON.parse(bucket.objects.get(p+'job.json').text);assert.deepEqual(saved.results,results);assert.deepEqual(saved.inventory,state.inventory);assert.equal(bucket.objects.get(p+'raw/vacations-17.json').text,'immutable-prefix');
});
