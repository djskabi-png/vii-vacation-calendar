import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createGalleryAuditJob, readGalleryAuditJob, stepGalleryAuditJob, readGalleryAuditItem } from "../app/lib/gallery-api-audit-job.ts";
import { createSergeyPublicCatalogClient } from '../app/lib/sergey-public-catalog-client.ts';

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const name of ["0000_groovy_boomerang", "0001_brief_pixie", "0002_sour_tigra", "0003_catalog_diagnostics"]) {
    const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
    for (const sql of source.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) sqlite.exec(sql);
  }
  const prepare = (sql) => { let values = []; return { bind(...args) { values = args; return this; }, async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; };
  return { prepare, close: () => sqlite.close() };
}

class R2 {
  constructor() { this.objects = new Map(); }
  async head(key) { const value = this.objects.get(key); return value ? { etag: value.etag } : null; }
  async put(key, value, options = {}) { if (options.onlyIf?.etagDoesNotMatch === "*" && this.objects.has(key)) return null; const result = { etag: `etag-${this.objects.size}` }; this.objects.set(key, { value: String(value), etag: result.etag }); return result; }
  async get(key) { const value = this.objects.get(key); return value ? { etag: value.etag, text: async () => value.value } : null; }
}

test("real SQLite catalog inventory supports a four-world gallery audit reservation", async () => {
  const db = await database();
  try {
    const worlds = ["vacations", "events", "rooms", "spa"];
    for (const [index, world] of worlds.entries()) {
      await db.prepare("INSERT INTO supplier_catalog_runs (id, world, source, status, candidate_count, started_at, finished_at) VALUES (?, ?, 'fixture', 'accepted', 1, '2026-11-09T00:00:00Z', '2026-11-09T00:00:01Z')").bind(`run-${world}`, world).run();
      await db.prepare("INSERT INTO supplier_catalog_state (world, active_run_id, accepted_at, active_count) VALUES (?, ?, '2026-11-09T00:00:01Z', 1)").bind(world, `run-${world}`).run();
      await db.prepare("INSERT INTO supplier_catalog_entries (id, run_id, world, supplier_id, summary_json, detail_json) VALUES (?, ?, ?, ?, ?, ?)").bind(`entry-${world}`, `run-${world}`, world, index + 1, JSON.stringify({ name: world }), JSON.stringify({ images: [`/gallery/${world}.jpg`] })).run();
    }
    const bucket = new R2();
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const created = await createGalleryAuditJob({ db, bucket, jobId: id, now: () => 1_000 });
    assert.equal(created.total, 4);
    assert.equal((await readGalleryAuditJob(bucket, id)).total, 4);
  } finally { db.close(); }
});

test('scoped vacation audit uses real SQLite and fetches no unrelated provider contexts',async()=>{
  const db=await database(),bucket=new R2(),calls=[];
  const locations={cities:[{id:1,title:'חיפה',area:2}],areas:[{id:2,title:'חיפה והקריות'}]};
  const listing={places:[{siteID:17,siteName:'מקום בדיקה',active:true,rooms:[{roomID:55}],galleries:[{galleryID:9,title:'כללי',pictures:['/gallery/place.jpg']}]}]};
  const raw='{"id":17,"active":true,"api_version":1.1,"name":"מקום בדיקה","location":{"city":1},"galleries":{"9":{"galleryID":9,"title":"כללי","pictures":["/gallery/place.jpg"]},"2":{"galleryID":2,"title":"נוסף","pictures":["/gallery/second.jpg"]}},"rooms":[{"roomID":55,"roomName":"יחידה","roomCount":1,"maxGuests":2,"amenities":[],"spaces":[],"galleries":[{"galleryID":2,"title":"יחידה","pictures":["/gallery/unit.jpg"]}]}]}';
  const fetchImpl=async input=>{const u=new URL(input),p=u.pathname.replace('/api/ai/vii','');calls.push(p);if(u.hostname!=='bizonline.co.il')throw Error('unrelated_provider');const value=p==='/locations'?locations:p==='/vacations'?listing:p==='/vacations/types'?{roomTypes:[],amenity_categories:[],amenities:[]}:p==='/vacations/17'?raw:null;if(!value)throw Error('unrelated_context');return new Response(typeof value==='string'?value:JSON.stringify(value));};
  try{
    const entry=(await createSergeyPublicCatalogClient({apiKey:'fixture',fetchImpl}).fetchCandidate('vacations')).entries[0];
    await db.prepare("INSERT INTO supplier_catalog_runs(id,world,source,status,candidate_count,started_at,finished_at) VALUES('vac','vacations','fixture','accepted',1,'2026-11-09T00:00:00Z','2026-11-09T00:00:01Z')").run();
    await db.prepare("INSERT INTO supplier_catalog_state(world,active_run_id,accepted_at,active_count) VALUES('vacations','vac','2026-11-09T00:00:01Z',1)").run();
    await db.prepare("INSERT INTO supplier_catalog_entries(id,run_id,world,supplier_id,summary_json,detail_json) VALUES('v17','vac','vacations',17,?,?)").bind(JSON.stringify(entry.summary),JSON.stringify(entry.detail)).run();
    calls.length=0;
    const jobId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const initial=await createGalleryAuditJob({db,bucket,jobId,scopeWorld:'vacations'});
    assert.equal(initial.scopeWorld,'vacations');assert.deepEqual(initial.worldCounts,{vacations:1,events:0,rooms:0,spa:0});
    const final=await stepGalleryAuditJob({db,bucket,jobId,env:{SERGEY_VII_API_TOKEN:'fixture'},fetchImpl});
    assert.equal(final.state,'complete');assert.equal(final.completed,1);assert.equal(final.matched,1,JSON.stringify(final));assert.deepEqual(final.sourceIssues,[]);
    assert.deepEqual(new Set(calls),new Set(['/locations','/vacations','/vacations/types','/vacations/17']));
    const item=await readGalleryAuditItem(bucket,jobId,'vacations',17);assert.deepEqual(item.api.entities.map(x=>x.imageIds),[['place.jpg','second.jpg'],['unit.jpg']]);
    const prior=bucket.objects.get('vii-gallery-audit/v1/'+jobId+'/job.json').value;
    await assert.rejects(createGalleryAuditJob({db,bucket,jobId,scopeWorld:'events'}),/gallery_audit_scope_changed/);
    assert.equal(bucket.objects.get('vii-gallery-audit/v1/'+jobId+'/job.json').value,prior);
    await assert.rejects(createGalleryAuditJob({db,bucket,jobId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',scopeWorld:'wrong'}),/invalid_audit_scope/);
  }finally{db.close();}
});
