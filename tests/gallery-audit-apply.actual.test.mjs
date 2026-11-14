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
  for (const name of ["0000_groovy_boomerang", "0001_brief_pixie", "0002_sour_tigra", "0003_catalog_diagnostics", "0013_adorable_moira_mactaggert"]) {
    const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
    for (const sql of source.split("--> statement-breakpoint").map(part => part.trim()).filter(Boolean)) sqlite.exec(sql);
  }
  const prepare = sql => { let values = []; return { bind(...args) { values = args; return this; }, async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; };
  return { prepare, async batch(statements) { sqlite.exec("BEGIN"); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } }, close() { sqlite.close(); } };
}

test("actual gallery apply repairs media while preserving accepted facts and is idempotent", async () => {
  const db = await database();
  const supplierId = 17;
  const baseline = { supplierId, summary: { name: "Place", price: 420, features: ["Pool"], images: ["/gallery/old-place.jpg"] }, detail: { price: 420, features: ["Pool"], images: ["/gallery/old-place.jpg"], galleryGroups: [{ id: 1, images: ["/gallery/old-place.jpg"] }], rooms: [{ id: 1701, name: "Suite", features: ["Bed"], images: ["/gallery/old-room.jpg"], galleryGroups: [{ id: 2, images: ["/gallery/old-room.jpg"] }] }] } };
  const normalized = { supplierId, summary: { name: "Place", price: 420, features: ["Pool"], images: ["/gallery/new-place.jpg"] }, detail: { price: 420, features: ["Pool"], images: ["/gallery/new-place.jpg"], galleryGroups: [{ id: 1, images: ["/gallery/new-place.jpg"] }], rooms: [{ id: 1701, name: "Suite", features: ["Bed"], images: ["/gallery/new-room.jpg"], galleryGroups: [{ id: 2, images: ["/gallery/new-room.jpg"] }] }] } };
  const wire = JSON.stringify({ api_version: 1.1, created: now.toISOString(), id: supplierId, active: true, galleries: { 1: { galleryID: 1, title: "Main", pictures: ["/gallery/new-place.jpg"] } }, rooms: [{ roomID: 1701, galleries: [{ galleryID: 2, title: "Suite", pictures: ["/gallery/new-room.jpg"] }] }] });
  const listWire = JSON.stringify({ places: [{ siteID: supplierId, active: true, galleries: { 1: { galleryID: 1, title: "Main", pictures: ["/gallery/new-place.jpg"] } }, rooms: [{ roomID: 1701 }] }] });
  const api = await buildApiGalleryContract("vacations", supplierId, { ...JSON.parse(wire), representative_galleries: JSON.parse(listWire).places[0].galleries }, wire);
  const acceptedContract = await buildAcceptedGalleryContract("vacations", baseline);
  const normalizedContract = await buildAcceptedGalleryContract("vacations", normalized);
  const proof = await proveSupplierMediaDetail(JSON.parse(wire), JSON.parse(listWire).places[0], normalized, baseline, now);
  assert.ok(proof);
  const finding = { world: "vacations", supplierId, status: "match", issues: [], recordKey: `${prefix}items/vacations-${supplierId}.json`, sha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(wire)))].map(x => x.toString(16).padStart(2, "0")).join("") };
  const job = { jobId, state: "complete", total: 1, cursor: 1, completed: 1, results: [finding], deadline: new Date(now.getTime() + 3600000).toISOString(), sourceIssues: [], worldCounts: { vacations: 1, events: 0, rooms: 0, spa: 0 } };
  const bucket = new FakeR2({ [`${prefix}job.json`]: JSON.stringify(job), [`${prefix}context/vacations.json`]: listWire, [`${prefix}raw/vacations-${supplierId}.json`]: wire, [`${prefix}items/vacations-${supplierId}.json`]: JSON.stringify({ finding, api, normalized, acceptedContract, normalizedContract, fetchedAt: now.toISOString(), rawKey: `${prefix}raw/vacations-${supplierId}.json` }), "legacy-gallery/v1/new-place.jpg": Object.assign(new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1]), { contentType: "image/jpeg" }), "legacy-gallery/v1/new-room.jpg": Object.assign(new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1]), { contentType: "image/jpeg" }) });
  bucket.objects.get("legacy-gallery/v1/new-place.jpg").contentType = "image/jpeg"; bucket.objects.get("legacy-gallery/v1/new-room.jpg").contentType = "image/jpeg";
  try {
    assert.equal((await runSupplierCatalogSync(db, { id: "seed-gallery-accepted", world: "vacations", source: "test", baseline: [baseline], now: () => now, fetchCandidate: async () => ({ fetchedAt: now.toISOString(), entries: [baseline] }) })).status, "accepted");
    const first = await applyGalleryAuditWorld({ db, bucket, jobId, world: "vacations" });
    assert.ok(bucket.headCalls.includes("legacy-gallery/v1/new-place.jpg")); assert.ok(bucket.headCalls.includes("legacy-gallery/v1/new-room.jpg"));
    assert.equal(first.state, "accepted"); assert.equal(first.verified, 1); assert.equal(first.skipped, 0);
    const row = await db.prepare("SELECT * FROM supplier_catalog_entries WHERE world = ? AND supplier_id = ? AND run_id = ?").bind("vacations", supplierId, first.runId).first();
    const persisted = { supplierId: row.supplier_id, summary: JSON.parse(row.summary_json), detail: JSON.parse(row.detail_json) };
    assert.deepEqual(persisted.detail.images, ["/gallery/new-place.jpg"]); assert.deepEqual(persisted.detail.rooms[0].images, ["/gallery/new-room.jpg"]);
    assert.equal(persisted.detail.price, 420); assert.deepEqual(persisted.detail.features, ["Pool"]); assert.equal(persisted.detail.rooms[0].name, "Suite");
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM supplier_catalog_runs").first()).n, 2);
    const writes = bucket.writes.length; const second = await applyGalleryAuditWorld({ db, bucket, jobId, world: "vacations" });
    assert.deepEqual(second, first); assert.equal(bucket.writes.length, writes); assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM supplier_catalog_runs").first()).n, 2); assert.deepEqual(await readGalleryAuditApply(bucket, jobId, "vacations"), first);
  } finally { db.close(); }
});
