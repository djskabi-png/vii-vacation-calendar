import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { reconcileGalleryAuditJob, readGalleryAuditPendingDiagnostics, createGalleryAuditJob, stepGalleryAuditJob } from "../app/lib/gallery-api-audit-job.ts";
import { createSergeyPublicCatalogClient } from '../app/lib/sergey-public-catalog-client.ts';

const id = "70707070-7070-4070-8070-707070707070";
const prefix = `vii-gallery-audit/v1/${id}/`;
const key = (suffix) => prefix + suffix;
const sha = (text) => createHash("sha256").update(text).digest("hex");

class Bucket {
  constructor() { this.objects = new Map(); this.puts = []; this.revision = 0; }
  async get(name) { const value = this.objects.get(name); return value ? { ...value, text: async () => value.body } : null; }
  async head(name) { const value = this.objects.get(name); return value ? { etag: value.etag, size: value.body.length, customMetadata: value.customMetadata, uploaded: value.uploaded } : null; }
  async put(name, body, options = {}) {
    const old = this.objects.get(name);
    if (options.onlyIf?.etagDoesNotMatch === "*" && old) return null;
    if (options.onlyIf?.etagMatches && (!old || old.etag !== options.onlyIf.etagMatches)) return null;
    const value = { body: String(body), etag: `e${++this.revision}`, size: String(body).length, customMetadata: options.customMetadata || {sha256:sha(String(body))}, uploaded: new Date(1_000 + this.revision * 2_000) };
    this.objects.set(name, value); this.puts.push(name); return value;
  }
}

function job(overrides = {}) {
  const inventory = [17, 18, 19, 20].map((supplierId) => ({ world: "vacations", supplierId }));
  const finding = { world: "vacations", supplierId: 17, status: "match", issues: [], recordKey: key("items/vacations-17.json") };
  return { jobId: id, state: "error", total: 4, completed: 1, cursor: 1, deadline: new Date(999_999).toISOString(), createdAt: new Date(0).toISOString(), contextsReady: true, contextMode: "per-world", contextWorlds: ["vacations"], inventory, results: [finding], sourceIssues: ["audit_operation_failed"], worldCounts: { vacations: 4, events: 0, rooms: 0, spa: 0 }, failure: { stage: "items", kind: "Error", code: "audit_operation_failed", targets: [18, 19, 20] }, ...overrides };
}

async function setup(overrides = {}) {
  const bucket = new Bucket();
  await bucket.put(key("job.json"), JSON.stringify(job(overrides)));
  const finding = { world: "vacations", supplierId: 17, status: "match", issues: [], recordKey: key("items/vacations-17.json") };
  await bucket.put(key("items/vacations-17.json"), JSON.stringify({ schemaVersion: 1, finding }));
  for (const supplierId of [18, 19, 20]) {
    const raw = JSON.stringify({ id: supplierId, active: true, galleries: [], rooms: [] });
    await bucket.put(key(`raw/vacations-${supplierId}.json`), raw, { customMetadata: { sha256: sha(raw) } });
  }
  bucket.puts = [];
  return bucket;
}

test("reconciles a complete local prefix and preserves raw and finding identities", async () => {
  const bucket = await setup();
  const before = new Map([...bucket.objects].filter(([name]) => !name.endsWith("job.json")).map(([name, value]) => [name, value.body]));
  const diagnostics = await readGalleryAuditPendingDiagnostics(bucket, id);
  assert.deepEqual(diagnostics.targets.map((x) => [x.supplierId, x.rawStored]), [[18, true], [19, true], [20, true]]);
  const result = await reconcileGalleryAuditJob({ bucket, jobId: id, now: () => 1_000 });
  assert.equal(result.storageRecoveryUsed, true);
  assert.equal(result.cursor, 1);
  for (const [name, body] of before) assert.equal(bucket.objects.get(name).body, body);
  const writes = bucket.puts.length;
  assert.deepEqual(await reconcileGalleryAuditJob({ bucket, jobId: id, now: () => 2_000 }), result);
  assert.equal(bucket.puts.length, writes);
});

async function actualFixture({nativeRate=false,failItem=true}={}) {
 const ids=[17,18,19,20],calls=[];
 const listing={places:ids.map(siteID=>({siteID,siteName:'מקום בדיקה',active:true,rooms:[{roomID:55}],galleries:[{galleryID:9,title:'כללי',pictures:['/gallery/place.jpg']}]}))};
 const detail=id=>({id,active:true,api_version:1.1,name:'מקום בדיקה',location:{city:1},galleries:{9:{galleryID:9,title:'כללי',pictures:['/gallery/place.jpg']}},rooms:[{roomID:55,roomName:'יחידה',roomCount:1,maxGuests:2,amenities:[],spaces:[],galleries:[{galleryID:2,title:'יחידה',pictures:['/gallery/unit.jpg']}]}]});
 const fetchImpl=async input=>{const u=new URL(input),p=u.pathname.replace('/api/ai/vii','');calls.push(p);const value=p==='/locations'?{cities:[{id:1,title:'חיפה',area:2}],areas:[{id:2,title:'חיפה והקריות'}]}:p==='/vacations'?listing:p==='/vacations/types'?{roomTypes:[],amenity_categories:[],amenities:[]}:p.match(/^\/vacations\/\d+$/)?detail(Number(p.split('/').at(-1))):null;if(!value)throw Error('unexpected_fixture_source');return new Response(JSON.stringify(value));};
 const accepted=(await createSergeyPublicCatalogClient({apiKey:'fixture',fetchImpl}).fetchCandidate('vacations')).entries;calls.length=0;
 const entries=new Map(accepted.map(x=>[x.supplierId,x]));
 const db={prepare(sql){return{bind(...args){return{first:async()=>{if(sql.includes('JOIN supplier_catalog_entries')){const entry=entries.get(args[1]);return entry?{summaryJson:JSON.stringify(entry.summary),detailJson:JSON.stringify(entry.detail),acceptedAt:new Date().toISOString()}:null;}return{activeRunId:'fixture-vac',activeCount:ids.length};},all:async()=>({results:ids.map(supplierId=>({supplierId}))})};}};}};
 const bucket=new Bucket(),put=bucket.put.bind(bucket);let injected=false,rateRejects=0;
 bucket.put=async(name,body,options)=>{
  const old=bucket.objects.get(name);if(nativeRate&&old&&Date.now()-old.uploaded.getTime()<1000){rateRejects++;throw Error('native_rate_limited');}
  if(failItem&&!injected&&name.endsWith('/items/vacations-20.json')){injected=true;throw Error('simulated storage outage');}
  const result=await put(name,body,options);if(result&&nativeRate)result.uploaded=new Date();return result;
 };
 const jobId='80808080-8080-4080-8080-808080808080';await createGalleryAuditJob({db,bucket,jobId,scopeWorld:'vacations'});
 return{db,bucket,jobId,env:{SERGEY_VII_API_TOKEN:'fixture'},fetchImpl,calls,rateRejects:()=>rateRejects};
}

test('real normalization resumes a partially committed batch with no repeated provider calls',async()=>{
 const f=await actualFixture();const first=await stepGalleryAuditJob({...f,batchSize:1});assert.equal(first.matched,1);
 const failed=await stepGalleryAuditJob(f);assert.equal(failed.state,'error');assert.equal(failed.cursor,1);assert.deepEqual(failed.sourceIssues,['audit_operation_failed']);assert.equal(failed.failure.stage,'items');
 const pending=await readGalleryAuditPendingDiagnostics(f.bucket,f.jobId);assert.deepEqual(pending.targets.map(x=>[x.supplierId,x.itemStored,x.rawStored]),[[18,true,true],[19,true,true],[20,false,true]]);
 const beforeCalls=f.calls.length,before=new Map([...f.bucket.objects].filter(([name])=>!name.endsWith('/job.json')).map(([name,value])=>[name,value.body]));
 const reconciled=await reconcileGalleryAuditJob(f);assert.equal(reconciled.cursor,1);assert.equal(reconciled.storageRecoveryUsed,true);
 const completed=await stepGalleryAuditJob(f);assert.equal(completed.state,'complete');assert.equal(completed.completed,4);assert.equal(completed.matched,4);assert.equal(f.calls.length,beforeCalls,'no source request is repeated during reconciliation or resumed batch');
 for(const[name,body]of before)assert.equal(f.bucket.objects.get(name).body,body);
 assert.equal(f.calls.filter(x=>/^\/vacations\/\d+$/.test(x)).length,4);
});

test('the actual audit writer honors native uploaded metadata and the same-key rate limit',async()=>{
 const f=await actualFixture({nativeRate:true,failItem:false});const result=await stepGalleryAuditJob(f);
 assert.equal(result.state,'complete');assert.equal(result.matched,4);assert.equal(f.rateRejects(),0);
});

test("rejects unsafe prefixes, missing or bad raw evidence, leases and deadlines without writes", async () => {
  const cases = [
    { inventory: [{ world: "events", supplierId: 17 }, { world: "vacations", supplierId: 18 }, { world: "vacations", supplierId: 19 }, { world: "vacations", supplierId: 20 }] },
    { results: [{ world: "vacations", supplierId: 17, status: "match", issues: [], recordKey: key("items/wrong.json") }] },
    { removeRaw: 20 }, { badRaw: 19 }, { lease: { owner: "other", until: new Date(9_999).toISOString() } },
    { deadline: new Date(900).toISOString(),continuationUsed:true }, { deadline:'bad' }, { sourceIssues: ["provider_http_500"] }, { cursor: 0, results: [] },
  ];
  for (const change of cases) {
    const bucket = await setup(change);
    if (change.removeRaw) bucket.objects.delete(key(`raw/vacations-${change.removeRaw}.json`));
    if (change.badRaw) bucket.objects.get(key(`raw/vacations-${change.badRaw}.json`)).customMetadata.sha256 = "bad";
    await assert.rejects(() => reconcileGalleryAuditJob({ bucket, jobId: id, now: () => 1_000 }));
    assert.equal(bucket.puts.length, 0, JSON.stringify(change));
  }
});

test('a reviewed cached-source recovery can use only the original fixed second hour',async()=>{
 const bucket=await setup({deadline:new Date(900).toISOString()});
 const value=await reconcileGalleryAuditJob({bucket,jobId:id,now:()=>1000});assert.equal(value.deadline,new Date(7200000).toISOString());assert.equal(value.continuationUsed,true);assert.equal(value.cursor,1);
});

test('concurrent reviewed recoveries create one CAS transition and one identical recovery window',async()=>{
 const bucket=await setup();const result=await Promise.all([reconcileGalleryAuditJob({bucket,jobId:id,now:()=>1000}),reconcileGalleryAuditJob({bucket,jobId:id,now:()=>1001})]);
 assert.equal(bucket.puts.length,1);assert.deepEqual(result[0],result[1]);assert.equal(result[0].cursor,1);
});
