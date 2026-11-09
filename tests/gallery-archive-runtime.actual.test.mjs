import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { readSupplierCatalog } from "../app/lib/supplier-catalog-store.ts";
import { runSupplierCatalogSync } from "../app/lib/supplier-catalog-sync.ts";
import { syncSupplierCatalogWorld } from "../app/lib/supplier-catalog-runtime.ts";
import { assertGallerySourceProjection } from "../app/lib/supplier-gallery-contract.ts";

async function database() { const sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys = ON"); for (const name of ["0000_groovy_boomerang", "0001_brief_pixie", "0002_sour_tigra", "0003_catalog_diagnostics"]) { const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8"); for (const sql of source.split("--> statement-breakpoint").map(x => x.trim()).filter(Boolean)) sqlite.exec(sql); } const prepare = sql => { let values = []; return { bind(...args) { values = args; return this; }, async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; }; return { prepare, async batch(xs) { sqlite.exec("BEGIN"); try { const out = []; for (const x of xs) out.push(await x.run()); sqlite.exec("COMMIT"); return out; } catch (e) { sqlite.exec("ROLLBACK"); throw e; } }, close() { sqlite.close(); } }; }
const now = () => new Date("2026-10-12T12:00:00Z");
const old = { supplierId: 17, summary: { name: "Place", images: ["/gallery/old.jpg"] }, detail: { features: ["Pool"], images: ["/gallery/old.jpg"], rooms: [{ id: 1701, features: ["Bed"], images: ["/gallery/old-room.jpg"] }] } };
const jpeg = new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1]);
function bucket({ valid = true, beforePut = async () => {} } = {}) { const objects = new Map(); const puts = []; const headCalls = []; return { puts, headCalls, async head(key) { headCalls.push(key); if (!key.endsWith("new.jpg")) return null; return { size: jpeg.length, httpMetadata: { contentType: valid ? "image/jpeg" : "text/html" } }; }, async put(key, value) { await beforePut(); puts.push({ key }); objects.set(key, value); return { etag: "saved" }; }, async get(key) { const data=objects.get(key)||(key.endsWith("new.jpg")?jpeg:null);return data?{size:data.length,httpMetadata:{contentType:"image/jpeg"},body:new Response(data).body}:null; } }; }
function apiFetch(url) { const path = new URL(url).pathname; if (path.endsWith("/locations")) return Promise.resolve(Response.json({ cities: [{ id: 1, title: "City", area: 2 }], areas: [{ id: 2, title: "Area" }] })); if (path.endsWith("/types")) return Promise.resolve(Response.json({ amenities: [], amenity_categories: [], roomTypes: [] })); if (path.endsWith("/vacations")) return Promise.resolve(Response.json({ places: [{ siteID: 17, siteName: "Place", active: true, location: { cityID: 1 }, galleries: { 1: { galleryID: 1, title: "Main", pictures: ["/gallery/new.jpg"] } }, rooms: [{ roomID: 1701 }] }] })); return Promise.resolve(Response.json({ api_version: 1.1, created: now().toISOString(), id: 17, active: true, name: "Place", location: { city: 1 }, shared_amenities: [], galleries: { 1: { galleryID: 1, title: "Main", pictures: ["/gallery/new.jpg"] } }, rooms: [{ roomID: 1701, galleries: [{ galleryID: 2, title: "Unit", pictures: ["/gallery/new-room.jpg"] }], amenities: [], spaces: [] }] })); }

test("runtime archive gate blocks invalid media and accepts prearchived official media", async () => {
  const previousToken = process.env.SERGEY_VII_API_TOKEN;
  process.env.SERGEY_VII_API_TOKEN = "local-fixture-only";
  const db = await database(); try { assert.equal((await runSupplierCatalogSync(db, { id: "seed-runtime", world: "vacations", source: "test", baseline: [old], now, fetchCandidate: async () => ({ fetchedAt: now().toISOString(), entries: [old] }) })).status, "accepted");
    const bad = bucket({ valid: false }); const rejected = await syncSupplierCatalogWorld(db, "vacations", "manual", { runId: "runtime-bad-media", detailSupplierId: 17, now, fetchImpl: apiFetch, mediaArchive: { bucket: bad, fetchImpl: async () => { throw Error("no_network"); } } }); assert.equal(rejected.status, "failed"); assert.deepEqual((await readSupplierCatalog(db, "vacations")).entries, [old]); assert.ok(bad.headCalls.some(key => key.endsWith("new.jpg")));
    const good = bucket({ beforePut: async () => assert.equal((await readSupplierCatalog(db, "vacations")).entries[0].detail.images[0], "/gallery/old.jpg") }); let mediaGets = 0; const accepted = await syncSupplierCatalogWorld(db, "vacations", "manual", { runId: "runtime-good-media", detailSupplierId: 17, now, fetchImpl: apiFetch, mediaArchive: { bucket: good, fetchImpl: async () => { mediaGets++; return new Response(jpeg, { status: 200, headers: { "content-type": "image/jpeg", "content-length": String(jpeg.length) } }); } } }); assert.equal(accepted.status, "accepted"); assert.equal(mediaGets, 1); assert.ok(good.puts.length >= 1); const current = await readSupplierCatalog(db, "vacations"); assert.equal(current.entries[0].detail.images[0], "/api/vii/media/new.jpg");
  } finally { db.close(); if (previousToken === undefined) delete process.env.SERGEY_VII_API_TOKEN; else process.env.SERGEY_VII_API_TOKEN = previousToken; }
});

test("publication projection gate rejects a reordered source gallery", async () => {
  await assert.rejects(() => assertGallerySourceProjection("vacations", 17,
    { galleries: [{ galleryID: 1, title: "Main", pictures: ["/gallery/first.jpg", "/gallery/second.jpg"] }], rooms: [] },
    { supplierId: 17, summary: {}, detail: { galleryGroups: [{ id: "1", title: "Main", images: ["/api/vii/media/second.jpg", "/api/vii/media/first.jpg"] }], images: ["/api/vii/media/second.jpg", "/api/vii/media/first.jpg"], rooms: [] } }), /supplier_gallery_projection_mismatch/);
});
