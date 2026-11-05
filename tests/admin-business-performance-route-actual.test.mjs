import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const rows = Array.from({ length: 921 }, (_, i) => ({
  placeId: `vacation-${i + 1}`, placeName: `מקום ${i + 1}`, world: "vacations",
  impressions: i, pageViews: i, phoneReveals: 0, phoneClicks: 0,
  whatsappLeads: 0, whatsappHandoffs: 0, bookingRequests: 0,
  uniqueBrowsers: i, viiBookings: 0, reviews: 0,
}));

function actualGet({ authenticated = true, mode = "overview", bizSchemaFails = false } = {}) {
  const calls = { snapshots: 0, failures: 0, history: 0, provider: 0, schema: 0 };
  const deps = {
    authorizedAdminSession: async () => authenticated ? { email: "admin@example.test" } : null,
    conversionTarget: () => null,
    fetchViiConversions: async () => { calls.provider++; throw new Error("provider must not run"); },
    ViiConversionsError: class extends Error {}, supplierToken: async () => "fixture",
    publicCatalogSummaries: async () => [], readSupplierCatalogInventory: async () => ({ entries: [] }),
    readSupplierCatalogSummaries: async () => ({ entries: [] }),
    bizConversionDatabase: async () => { calls.schema++; if (bizSchemaFails) throw new Error("biz schema discovery must not run for overview"); return { prepare: () => ({ all: async () => ({ results: [] }) }) }; },
    loadCachedBizConversions: async () => { calls.snapshots++; throw new Error("snapshots must not run"); },
    loadCachedBizConversionFailures: async () => { calls.failures++; throw new Error("failures must not run"); },
    readCachedBizConversionFailure: async () => null, saveBizConversionFailure: async () => null,
    readBizReportRuns: async () => { calls.history++; throw new Error("history must not run"); },
    startBizReportRun: async () => null, stopBizReportRun: async () => null, updateBizReportRun: async () => null,
    cachedAdminReport: async () => ({ value: { rows }, cache: { status: "fresh", savedAt: "2026-11-04T00:00:00Z", stale: false } }),
    mergeBusinessPerformanceRows: (...groups) => groups.flat(),
    reportingDatabase: async () => ({ database: {}, origin: "fixture", degraded: false }),
    isClosedReportPeriod: () => true,
    getRequestExecutionContext: () => null,
  };
  const source = readFileSync(new URL("../app/api/admin/business-performance/route.ts", import.meta.url), "utf8")
    .replace(/^[\s\S]*?const headers =/m, "const headers =")
    .replace("export async function GET", "async function GET")
    .replace("export async function POST", "async function POST");
  const code = stripTypeScriptTypes(source, { mode: "strip" });
  const GET = new Function(...Object.keys(deps), `${code}; return GET;`)(...Object.values(deps));
  return { GET, calls };
}

test("actual overview handler returns complete lightweight inventory without Biz fan-out", async () => {
  const { GET, calls } = actualGet();
  const response = await GET(new Request("https://example.test/api/admin/business-performance?mode=overview&from=2026-11-04&till=2026-11-04"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.rows.length, 921);
  assert.equal(Object.hasOwn(body, "bizSnapshots"), false);
  assert.equal(Object.hasOwn(body, "runHistory"), false);
  assert.deepEqual(calls, { snapshots: 0, failures: 0, history: 0, provider: 0, schema: 0 });
});

test("actual overview succeeds when Biz schema discovery is unavailable", async () => {
  const { GET, calls } = actualGet({ bizSchemaFails: true });
  const response = await GET(new Request("https://example.test/api/admin/business-performance?mode=overview&from=2026-11-04&till=2026-11-04"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.rows.length, 921);
  assert.equal(calls.schema, 0);
});

test("actual handler enforces auth before touching reporting data", async () => {
  const { GET, calls } = actualGet({ authenticated: false });
  const response = await GET(new Request("https://example.test/api/admin/business-performance?mode=overview&from=2026-11-04&till=2026-11-04"));
  assert.equal(response.status, 403);
  assert.deepEqual(calls, { snapshots: 0, failures: 0, history: 0, provider: 0, schema: 0 });
});

test("actual Biz snapshots handler never reconstructs the analytics report", async () => {
  const fixture = actualGet();
  const original = fixture.GET;
  // Rebuild a handler with a report-cache spy that would fail if the lazy
  // branch fell through to the overview report builder.
  const { GET } = (() => {
    const source = readFileSync(new URL("../app/api/admin/business-performance/route.ts", import.meta.url), "utf8")
      .replace(/^[\s\S]*?const headers =/m, "const headers =")
      .replace("export async function GET", "async function GET")
      .replace("export async function POST", "async function POST");
    const deps = {
      authorizedAdminSession: async () => ({ email: "admin@example.test" }), conversionTarget: () => null,
      fetchViiConversions: async () => { throw new Error("provider must not run"); }, ViiConversionsError: class extends Error {}, supplierToken: async () => "fixture",
      publicCatalogSummaries: async () => [], readSupplierCatalogInventory: async () => ({ entries: [] }), readSupplierCatalogSummaries: async () => ({ entries: [] }),
      bizConversionDatabase: async () => ({ prepare: () => ({ all: async () => ({ results: [] }) }) }),
      loadCachedBizConversions: async () => [], loadCachedBizConversionFailures: async () => [], readCachedBizConversionFailure: async () => null, saveBizConversionFailure: async () => null,
      readBizReportRuns: async () => [], startBizReportRun: async () => null, stopBizReportRun: async () => null, updateBizReportRun: async () => null,
      cachedAdminReport: async () => { throw new Error("analytics report must not run in biz-snapshots mode"); },
      mergeBusinessPerformanceRows: (...groups) => groups.flat(), reportingDatabase: async () => ({ database: {}, origin: "fixture", degraded: false }), isClosedReportPeriod: () => true, getRequestExecutionContext: () => null,
    };
    const code = stripTypeScriptTypes(source, { mode: "strip" });
    return new Function(...Object.keys(deps), `${code}; return { GET };`)(...Object.values(deps));
  })();
  assert.equal((await GET(new Request("https://example.test/api/admin/business-performance?mode=biz-snapshots&from=2026-11-04&till=2026-11-04"))).status, 200);
  assert.equal(typeof original, "function");
});

test("actual route source has no arbitrary analytics-group truncation and cache generation is bumped", async () => {
  const source = readFileSync(new URL("../app/api/admin/business-performance/route.ts", import.meta.url), "utf8");
  assert.match(source, /inventory: "accepted-generation-v3"/);
  const analyticsQuery = source.slice(source.indexOf("FROM vii_business_events"), source.indexOf("FROM vii_booking_audit"));
  assert.doesNotMatch(analyticsQuery, /LIMIT\s+500/i);
  // The handler fixture above already proves that the response preserves 921
  // rows. This guard specifically prevents a future SQL cap from silently
  // reintroducing the historical 500-group loss.
  assert.equal(rows.length, 921);
});
