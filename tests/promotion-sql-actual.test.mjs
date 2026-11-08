import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { readActivePromotionWeights, readPromotionDraftDashboard, savePromotionDraft } from "../app/lib/discovery-promotion-drafts.ts";

function d1(db) {
  return { prepare(sql) { let args=[]; return { bind(...values) { args=values; return this; }, all: async () => ({ results: db.prepare(sql).all(...args) }), first: async () => db.prepare(sql).get(...args) || null, run: async () => ({ success: Boolean(db.prepare(sql).run(...args)) }) }; } };
}

function migratedDatabase() {
  const db = new DatabaseSync(":memory:");
  for (const name of ["0002_sour_tigra", "0004_futuristic_beast", "0012_promotion_membership_flags"])
    db.exec(readFileSync(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8"));
  db.prepare("INSERT INTO supplier_catalog_runs (id,world,source,status,started_at) VALUES (?,?,?,?,?)")
    .run("active", "vacations", "isolated-test", "accepted", "2026-01-01");
  db.prepare("INSERT INTO supplier_catalog_state (world,active_run_id,accepted_at,active_count) VALUES (?,?,?,?)")
    .run("vacations", "active", "2026-01-01", 1);
  db.prepare("INSERT INTO supplier_catalog_entries (id,run_id,world,supplier_id,summary_json) VALUES (?,?,?,?,?)")
    .run("place", "active", "vacations", 101, JSON.stringify({name:"Verified supplier"}));
  return db;
}

const draftInput = (overrides={}) => ({requestId:crypto.randomUUID(),world:"vacations",supplierId:101,kind:"manual",weight:3,
  startsOn:"2026-01-01",endsOn:"2026-12-31",note:"Isolated qualification",status:"draft",featured:true,turboEligible:true,...overrides});

test("real migrations and SQL preserve membership through admin versions, clear and archive", async () => {
  const sqlite=migratedDatabase(), db=d1(sqlite), now="2026-06-01T00:00:00Z";
  try {
    const first=draftInput();
    const created=await savePromotionDraft(db,first,"qa@example.invalid");
    assert.deepEqual(await readActivePromotionWeights(db,now),[]);
    const repeated=await savePromotionDraft(db,first,"qa@example.invalid");
    assert.equal(repeated.eventId,created.eventId);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM discovery_promotion_draft_events").get().n,1);
    await assert.rejects(savePromotionDraft(db,{...first,turboEligible:false},"qa@example.invalid"),{code:"request_id_conflict"});
    const published=await savePromotionDraft(db,draftInput({campaignId:created.campaignId,expectedVersion:1,status:"published"}),"qa@example.invalid");
    assert.deepEqual(await readActivePromotionWeights(db,now),[{world:"vacations",supplierId:101,weight:3,featured:true,turboEligible:true}]);
    const cleared=await savePromotionDraft(db,draftInput({campaignId:created.campaignId,expectedVersion:2,status:"published",featured:false,turboEligible:false}),"qa@example.invalid");
    assert.deepEqual(await readActivePromotionWeights(db,now),[{world:"vacations",supplierId:101,weight:3}]);
    await assert.rejects(savePromotionDraft(db,draftInput({campaignId:created.campaignId,expectedVersion:2}),"qa@example.invalid"),{code:"version_conflict"});
    const second=await savePromotionDraft(db,draftInput({status:"published",weight:1,featured:true,turboEligible:false}),"qa@example.invalid");
    assert.deepEqual(await readActivePromotionWeights(db,now),[{world:"vacations",supplierId:101,weight:3,featured:true}]);
    await savePromotionDraft(db,draftInput({campaignId:created.campaignId,expectedVersion:cleared.version,status:"archived",featured:false,turboEligible:false}),"qa@example.invalid");
    assert.deepEqual(await readActivePromotionWeights(db,now),[{world:"vacations",supplierId:101,weight:1,featured:true}]);
    await savePromotionDraft(db,draftInput({campaignId:second.campaignId,expectedVersion:second.version,status:"archived"}),"qa@example.invalid");
    assert.deepEqual(await readActivePromotionWeights(db,now),[]);
    const dashboard=await readPromotionDraftDashboard(db);
    assert.equal(dashboard.drafts.length,2);
    assert.equal(dashboard.activity.length,6);
    assert.equal(published.version,2);
  } finally { sqlite.close(); }
});

test("expired/future campaigns and missing catalogs cannot enable promoted membership", async () => {
  const sqlite=migratedDatabase(), db=d1(sqlite), now="2026-06-01T00:00:00Z";
  try {
    await savePromotionDraft(db,draftInput({status:"published",endsOn:"2026-05-31"}),"qa@example.invalid");
    await savePromotionDraft(db,draftInput({status:"published",startsOn:"2026-06-02"}),"qa@example.invalid");
    assert.deepEqual(await readActivePromotionWeights(db,now),[]);
    await savePromotionDraft(db,draftInput({status:"published"}),"qa@example.invalid");
    sqlite.exec("UPDATE supplier_catalog_state SET active_run_id=NULL");
    assert.deepEqual(await readActivePromotionWeights(db,now),[]);
    await assert.rejects(savePromotionDraft(db,draftInput(),"qa@example.invalid"),{code:"place_not_published"});
  } finally { sqlite.close(); }
});

test("unexpected database failure is not hidden behind legacy projection", async () => {
  const sqlite=new DatabaseSync(":memory:");
  try { await assert.rejects(readActivePromotionWeights(d1(sqlite)),/no such table/); }
  finally {sqlite.close();}
});

test("actual SQLite promotion projection joins active catalog and preserves flags", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE discovery_promotion_draft_events (event_id TEXT PRIMARY KEY,campaign_id TEXT,version INTEGER,world TEXT,supplier_id INTEGER,place_name TEXT,kind TEXT,weight INTEGER,featured INTEGER NOT NULL DEFAULT 0,turbo_eligible INTEGER NOT NULL DEFAULT 0,starts_on TEXT,ends_on TEXT,contract_ends_on TEXT,contract_source TEXT,note TEXT,status TEXT,actor_email TEXT,saved_at TEXT);
    CREATE TABLE supplier_catalog_state (world TEXT PRIMARY KEY,active_run_id TEXT);
    CREATE TABLE supplier_catalog_entries (id TEXT PRIMARY KEY,run_id TEXT,world TEXT,supplier_id INTEGER,summary_json TEXT,detail_json TEXT);`);
  db.prepare("INSERT INTO supplier_catalog_state VALUES (?,?)").run("vacations", "run-a");
  db.prepare("INSERT INTO supplier_catalog_entries VALUES (?,?,?,?,?,?)").run("1", "run-a", "vacations", 101, "{}", null);
  db.prepare("INSERT INTO supplier_catalog_entries VALUES (?,?,?,?,?,?)").run("2", "run-old", "vacations", 102, "{}", null);
  db.prepare("INSERT INTO discovery_promotion_draft_events (event_id,campaign_id,version,world,supplier_id,place_name,kind,weight,featured,turbo_eligible,starts_on,ends_on,status,note,actor_email,saved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("e1", "c1", 1, "vacations", 101, "A", "manual", 4, 1, 1, "2026-01-01", "2026-12-31", "published", "", "qa", "2026-01-01");
  db.prepare("INSERT INTO discovery_promotion_draft_events (event_id,campaign_id,version,world,supplier_id,place_name,kind,weight,featured,turbo_eligible,starts_on,ends_on,status,note,actor_email,saved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("e2", "c2", 1, "vacations", 102, "B", "manual", 5, 1, 1, "2026-01-01", "2026-12-31", "published", "", "qa", "2026-01-01");
  const rows = await readActivePromotionWeights(d1(db), "2026-06-01T00:00:00Z");
  assert.deepEqual(rows, [{ world: "vacations", supplierId: 101, weight: 4, featured: true, turboEligible: true }]);
  db.close();
});

test("pre-migration SQLite schema preserves old manual weights without enabling flags", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE discovery_promotion_draft_events (event_id TEXT PRIMARY KEY,campaign_id TEXT,version INTEGER,world TEXT,supplier_id INTEGER,place_name TEXT,kind TEXT,weight INTEGER,starts_on TEXT,ends_on TEXT,status TEXT);
    CREATE TABLE supplier_catalog_state (world TEXT PRIMARY KEY,active_run_id TEXT);
    CREATE TABLE supplier_catalog_entries (id TEXT PRIMARY KEY,run_id TEXT,world TEXT,supplier_id INTEGER);`);
  db.prepare("INSERT INTO supplier_catalog_state VALUES (?,?)").run("vacations", "run-a");
  db.prepare("INSERT INTO supplier_catalog_entries VALUES (?,?,?,?)").run("1", "run-a", "vacations", 101);
  db.prepare("INSERT INTO discovery_promotion_draft_events VALUES (?,?,?,?,?,?,?,?,?,?,?)").run("e1", "c1", 1, "vacations", 101, "A", "manual", 4, "2026-01-01", "2026-12-31", "published");
  assert.deepEqual(await readActivePromotionWeights(d1(db), "2026-06-01T00:00:00Z"), [{ world: "vacations", supplierId: 101, weight: 4 }]);
  db.close();
});
