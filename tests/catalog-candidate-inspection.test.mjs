import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectSupplierCatalogWorld } from "../app/lib/supplier-catalog-runtime.ts";

function dbFixture() {
  const writes = [];
  return { writes, prepare(sql) {
    return { bind(...args) { this.args = args; return this; }, async first() {
      return sql.includes("supplier_catalog_state") ? { activeRunId: "accepted", activeCount: 1, acceptedAt: "2026-11-05" } : null;
    }, async all() { return { results: sql.includes("supplier_catalog_entries") ? [{ supplierId: 1, summaryJson: '{"name":"Old"}', detailJson: '{"rooms":[]}' }] : [] }; },
      async run() { writes.push(sql); return {}; } };
  } };
}

test("candidate inspection compares without writing and bounds the public result", async () => {
  const db = dbFixture();
  const payloads = {
    "/locations": { cities: [{ id: 1, title: "חיפה", area: 2 }], areas: [{ id: 2, title: "חיפה והקריות" }] },
    "/vacations": { places: [{ active: true, siteID: 1, siteName: "New", location: { cityID: 1 }, galleries: [] }] },
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
});

test("provider failure during readonly inspection cannot write or replace accepted data",async()=>{
  const db=dbFixture();
  await assert.rejects(inspectSupplierCatalogWorld(db,"events",{apiKey:"fixture",fetchImpl:async()=>new Response(null,{status:503})}),/sergey_provider_error/);
  assert.equal(db.writes.length,0);
});
