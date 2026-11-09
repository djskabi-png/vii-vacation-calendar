import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { runSupplierCatalogSync } from "../app/lib/supplier-catalog-sync.ts";
import { applyGalleryAuditWorld, readGalleryAuditApply } from "../app/lib/gallery-audit-apply.ts";
import { buildAcceptedGalleryContract, buildApiGalleryContract } from "../app/lib/supplier-gallery-contract.ts";
import { proveSupplierMediaDetail } from "../app/lib/supplier-detail-contract.ts";

const jobId = "77777777-7777-4777-8777-777777777777";
const prefix = `vii-gallery-audit/v1/${jobId}/`;
const now = new Date();

class FakeR2 {
  constructor(initial = {}) { this.objects = new Map(Object.entries(initial).map(([key, value]) => [key, { value, etag: `seed-${key}`, contentType: "application/json" }])); this.writes = []; this.headCalls = []; }
  async head(key) { this.headCalls.push(key); const object = this.objects.get(key); return object ? { etag: object.etag, size: typeof object.value === "string" ? new TextEncoder().encode(object.value).length : object.value.byteLength, httpMetadata: { contentType: object.contentType } } : null; }
  async get(key) { const object = this.objects.get(key); return object ? { etag: object.etag, size: typeof object.value === "string" ? new TextEncoder().encode(object.value).length : object.value.byteLength, httpMetadata: { contentType: object.contentType }, body: typeof object.value === "string" ? new Response(object.value).body : new Response(object.value).body, async text() { return typeof object.value === "string" ? object.value : new TextDecoder().decode(object.value); } } : null; }
  async put(key, value, options = {}) {
    const prior = this.objects.get(key);
    if (options.onlyIf?.etagDoesNotMatch === "*" && prior) return null;
    if (options.onlyIf?.etagMatches && (!prior || prior.etag !== options.onlyIf.etagMatches)) return null;
    const etag = `etag-${this.writes.length + 1}`;
    this.objects.set(key, { value, etag, contentType: options.httpMetadata?.contentType || "application/json" }); this.writes.push({ key, value, options }); return { etag };
  }
}

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const name of ["0000_groovy_boomerang", "0001_brief_pixie", "0002_sour_tigra", "0003_catalog_diagnostics"]) {
    const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
    for (const sql of source.split("--> statement-breakpoint").map(part => part.trim()).filter(Boolean)) sqlite.exec(sql);
  }
  const prepare = sql => { let values = []; return { bind(...args) { values = args; return this; }, async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; };
  return { prepare, async batch(statements) { sqlite.exec("BEGIN"); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } }, close() { sqlite.close(); } };
}


async function runPrefetchCase(tamper=''){
 const db=await database(), baseline=[], normalized=[], findings=[], objects={};
 const hash=async wire=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(wire)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 for(let i=1;i<=9;i++){
  const old={supplierId:i,summary:{name:'Place '+i,price:420,features:['Pool'],images:['/gallery/same.jpg']},detail:{price:420,features:['Pool'],images:['/gallery/same.jpg'],galleryGroups:[{id:'old',images:['/gallery/same.jpg']}],rooms:[{id:i*100,name:'Unit '+i,images:['/gallery/same.jpg'],galleryGroups:[{id:'old-room',images:['/gallery/same.jpg']}]}]}};
  const next=structuredClone(old);next.detail.galleryGroups[0].id='9';next.detail.rooms[0].galleryGroups[0].id='2';baseline.push(old);normalized.push(next);
  const raw={api_version:1.1,created:now.toISOString(),id:i,active:true,galleries:{9:{galleryID:9,title:String(123),pictures:['/gallery/same.jpg']}},rooms:[{roomID:i*100,galleries:[{galleryID:2,title:String(456),pictures:['/gallery/same.jpg']}]}]},wire=JSON.stringify(raw);
  const finding={world:'vacations',supplierId:i,status:'mismatch',issues:[],recordKey:prefix+'items/vacations-'+i+'.json',sha256:await hash(wire)};findings.push(finding);
  objects[prefix+'raw/vacations-'+i+'.json']=wire;
  objects[finding.recordKey]=JSON.stringify({finding,api:await buildApiGalleryContract('vacations',i,raw,wire),normalized:next,acceptedContract:await buildAcceptedGalleryContract('vacations',old),normalizedContract:await buildAcceptedGalleryContract('vacations',next),fetchedAt:now.toISOString(),rawKey:prefix+'raw/vacations-'+i+'.json'});
 }
 objects[prefix+'context/vacations.json']=JSON.stringify({places:baseline.map(x=>({siteID:x.supplierId,active:true,rooms:[{roomID:x.supplierId*100}]}))});
 objects[prefix+'job.json']=JSON.stringify({jobId,state:'complete',total:9,cursor:9,results:findings,deadline:new Date(now.getTime()+3600000).toISOString(),sourceIssues:[],worldCounts:{vacations:9,events:0,rooms:0,spa:0}});
 if(tamper==='hash')objects[prefix+'raw/vacations-1.json']+=' ';
 if(tamper==='foreign'){const item=JSON.parse(objects[prefix+'items/vacations-1.json']);item.rawKey='another-job/private.json';objects[prefix+'items/vacations-1.json']=JSON.stringify(item);}
 const bucket=new FakeR2(objects),get=bucket.get.bind(bucket);let inflight=0,max=0;const readKeys=[];bucket.get=async key=>{readKeys.push(key);const bounded=key.includes('/items/')||key.includes('/raw/');if(!bounded)return get(key);inflight++;max=Math.max(max,inflight);try{await new Promise(r=>setImmediate(r));return await get(key);}finally{inflight--;}};
 try{
  assert.equal((await runSupplierCatalogSync(db,{id:'prefetch-seed',world:'vacations',source:'test',baseline,now:()=>now,fetchCandidate:async()=>({fetchedAt:now.toISOString(),entries:baseline})})).status,'accepted');
  const receipt=await applyGalleryAuditWorld({db,bucket,jobId,world:'vacations'});
  if(tamper){assert.equal(receipt.state,'not_accepted',JSON.stringify(receipt));assert.equal(receipt.verified,0);assert.ok(!readKeys.includes('another-job/private.json'));const current=await db.prepare('SELECT active_run_id FROM supplier_catalog_state WHERE world = ?').bind('vacations').first();assert.equal(current.active_run_id,'prefetch-seed');return;}
  assert.equal(receipt.state,'accepted',JSON.stringify(receipt));assert.equal(receipt.verified,9);assert.equal(receipt.changed,9);assert.equal(receipt.skipped,0);assert.equal(max,4);
  const rows=(await db.prepare('SELECT summary_json,detail_json FROM supplier_catalog_entries WHERE run_id = ?').bind(receipt.runId).all()).results;assert.equal(rows.length,9);for(const row of rows){const d=JSON.parse(row.detail_json),s=JSON.parse(row.summary_json);assert.equal(d.price,420);assert.deepEqual(d.features,['Pool']);assert.match(d.rooms[0].name,/^Unit /);assert.equal(d.galleryGroups[0].id,'9');assert.equal(s.price,420);}
  const writes=bucket.writes.length;assert.deepEqual(await applyGalleryAuditWorld({db,bucket,jobId,world:'vacations'}),receipt);assert.equal(bucket.writes.length,writes);
 }finally{db.close();}
}
test('actual nine-entry apply prefetches at most four sources and preserves every nonmedia fact',()=>runPrefetchCase());
test('prefetched corrupt source bytes keep the previous public generation',()=>runPrefetchCase('hash'));
test('prefetch rejects a foreign raw key before reading it or changing the generation',()=>runPrefetchCase('foreign'));
