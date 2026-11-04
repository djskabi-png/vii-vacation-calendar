import assert from "node:assert/strict";
import test from "node:test";
import { mergeBusinessPerformanceRows } from "../app/lib/business-performance-rows.ts";
import { readFile } from "node:fs/promises";

test("business selector receives one canonical row when singular and plural world aliases coexist", () => {
  const rows = mergeBusinessPerformanceRows(
    [{ placeId: "vacation-116", placeName: "עסק", world: "vacations" }],
    [{ placeId: "vacation-116", placeName: "עסק", world: "vacation", pageViews: 4 }],
    [{ placeId: "vacation-116", placeName: "עסק", world: "vacations", pageViews: 3 }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].world, "vacations");
  assert.equal(rows[0].pageViews, 7);
});

test("different place ids remain separate", () => {
  const rows = mergeBusinessPerformanceRows([
    { placeId: "vacation-116", placeName: "א", world: "vacations" },
    { placeId: "vacation-117", placeName: "ב", world: "vacation" },
  ]);
  assert.deepEqual(rows.map((row) => row.placeId).sort(), ["vacation-116", "vacation-117"]);
});

test("business performance report uses reporting failover before initializing derived Biz caches", async () => {
  const source = await readFile(new URL("../app/api/admin/business-performance/route.ts", import.meta.url), "utf8");
  assert.match(source, /const reporting = await reportingDatabase\(\)/);
  assert.match(source, /bizConversionDatabase\(reporting\.database\)/);
  assert.match(source, /database \? loadCachedBizConversions/);
  assert.doesNotMatch(source, /const cacheDb = await bizConversionDatabase\(\);/);
});

test("Biz portfolio inventory uses the complete accepted supplier generation", async () => {
  const source = await readFile(new URL("../app/api/admin/business-performance/route.ts", import.meta.url), "utf8");
  assert.match(source, /readSupplierCatalogSummaries\(db, world\)/);
  assert.match(source, /supportedInventory\(cacheDb\)/);
  assert.match(source, /inventory: "accepted-generation-v3"/);
  assert.match(source, /intentionally filtered/);
});

test("Biz reporting deduplicates one supplier that appears in several worlds", async () => {
  const page = await readFile(new URL("../app/admin/business-performance/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/admin/business-performance/route.ts", import.meta.url), "utf8");
  assert.match(page, /function uniqueConversionBusinesses/);
  assert.match(page, /uniqueConversionBusinesses\(supportedRows\.filter/);
  assert.match(page, /uniqueConversionBusinesses\(filtered\.filter\(conversionSupported\)\)/);
  assert.match(route, /function uniqueConversionRows/);
  assert.match(route, /const supportedRows = uniqueConversionRows\(report\.value\.rows as/);
  assert.match(route, /if \(requestedTargets\.length !== body\.targets\.length\)/);
  assert.match(route, /const targets = uniqueConversionRows\(requestedTargets\)/);
});

test("business performance exposes a lightweight overview without eager Biz snapshots or history", async () => {
  const source = await readFile(new URL("../app/api/admin/business-performance/route.ts", import.meta.url), "utf8");
  assert.match(source, /if \(mode === "overview"\)/);
  assert.match(source, /rows: report\.value\.rows, reportCache: report\.cache/);
  assert.match(source, /if \(mode !== "legacy" && mode !== "biz-snapshots"\)/);
  const overview = source.slice(source.indexOf('if (mode === "overview")'), source.indexOf('if (mode !== "legacy"'));
  assert.doesNotMatch(overview, /loadCachedBizConversions|loadCachedBizConversionFailures|readBizReportRuns|bizSnapshots/);
});

test("Biz snapshots mode remains separate and legacy responses retain history", async () => {
  const source = await readFile(new URL("../app/api/admin/business-performance/route.ts", import.meta.url), "utf8");
  assert.match(source, /mode === "legacy" && database \? readBizReportRuns/);
  assert.match(source, /mode === "legacy" \? \{ runHistory \} : \{\}/);
  assert.match(source, /mode !== "legacy" && mode !== "biz-snapshots"/);
});

test("admin inventory projection selects identity fields without loading full summary JSON", async () => {
  const source = await readFile(new URL("../app/lib/supplier-catalog-store.ts", import.meta.url), "utf8");
  assert.match(source, /export async function readSupplierCatalogInventory/);
  assert.match(source, /json_extract\(summary_json, '\$\.name'\)/);
  assert.match(source, /json_extract\(summary_json, '\$\.title'\)/);
  assert.match(source, /json_extract\(summary_json, '\$\.id'\)/);
  const route = await readFile(new URL("../app/api/admin/business-performance/route.ts", import.meta.url), "utf8");
  assert.match(route, /readSupplierCatalogInventory\(db, world\)/);
});
