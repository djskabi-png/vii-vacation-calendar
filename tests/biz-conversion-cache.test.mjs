import test from "node:test";
import assert from "node:assert/strict";
import { cachedBizConversions, loadCachedBizConversions, loadCachedBizConversionFailures,
  readCachedBizConversionFailure, saveBizConversionFailure } from "../app/lib/biz-conversion-cache.ts";

const bucket = { contacts: 3, identified: 3, converted: 2, rate: 66.7, customers: 2, orders: 2, revenue: 1900, medianDelay: 300 };
const fixture = (created = "2026-10-25T08:00:00Z") => ({
  siteID: 2566, from: "2026-10-01", till: "2026-10-25", domainID: 7, created, count: 3,
  summary: { all: bucket, whatsapp: bucket, maskyoo: bucket, form: bucket },
  clicks: { whatsapp: 4, showphone: 2, phone: 1 },
});

class MemoryStatement {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...params) { return new MemoryStatement(this.db, this.sql, params); }
  async run() {
    if (/INSERT INTO vii_biz_conversion_snapshots_v1/.test(this.sql)) {
      const [cacheKey, world, siteID, fromDay, tillDay, payload, supplierCreatedAt, savedAt, staleAfter] = this.params;
      this.db.rows.set(cacheKey, { world, siteID, fromDay, tillDay, payload, supplierCreatedAt, savedAt, staleAfter });
    }
    if (/INSERT INTO vii_biz_conversion_failures_v1/.test(this.sql)) {
      const [cacheKey, world, siteID, fromDay, tillDay, errorCode, savedAt, retryAt] = this.params;
      this.db.failures.set(cacheKey, { world, siteID, fromDay, tillDay, errorCode, savedAt, retryAt });
    }
    if (/DELETE FROM vii_biz_conversion_failures_v1/.test(this.sql)) this.db.failures.delete(this.params[0]);
    return { success: true, meta: { changes: 1 } };
  }
  async first() {
    if (/FROM vii_biz_conversion_failures_v1 WHERE cache_key = \?/.test(this.sql)) return this.db.failures.get(this.params[0]) || null;
    if (/WHERE cache_key = \?/.test(this.sql)) return this.db.rows.get(this.params[0]) || null;
    return null;
  }
  async all() {
    if (/FROM vii_biz_conversion_failures_v1/.test(this.sql) && /WHERE from_day = \? AND till_day = \?/.test(this.sql)) {
      return { success: true, results: [...this.db.failures.values()].filter((row) => row.fromDay === this.params[0] && row.tillDay === this.params[1]) };
    }
    if (/WHERE from_day = \? AND till_day = \?/.test(this.sql)) {
      return { success: true, results: [...this.db.rows.values()].filter((row) => row.fromDay === this.params[0] && row.tillDay === this.params[1]) };
    }
    return { success: true, results: [] };
  }
}

class MemoryDatabase {
  rows = new Map();
  failures = new Map();
  prepare(sql) { return new MemoryStatement(this, sql); }
  async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); }
}

test("supplier failures persist so reopening the same period does not retry a known failing target", async () => {
  const db = new MemoryDatabase();
  const saved = await saveBizConversionFailure(db, { world: "vacations", siteID: 99,
    from: "2026-10-01", till: "2026-10-25", error: "not_supported", now: new Date("2026-10-25T10:00:00Z") });
  assert.equal(saved.cache.status, "failure_cached");
  const exact = await readCachedBizConversionFailure(db, "vacations", 99, "2026-10-01", "2026-10-25", new Date("2026-10-26T10:00:00Z"));
  assert.equal(exact?.error, "not_supported");
  assert.equal(exact?.cache.stale, false);
  const reloaded = await loadCachedBizConversionFailures(db, "2026-10-01", "2026-10-25", new Date("2026-10-26T10:00:00Z"));
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].siteID, 99);
});

test("Biz conversion aggregates persist and an identical fresh pull does not call the supplier again", async () => {
  const db = new MemoryDatabase();
  let supplierCalls = 0;
  const options = { db, world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-25",
    fetcher: async () => { supplierCalls += 1; return fixture(); } };
  const first = await cachedBizConversions(options);
  const second = await cachedBizConversions(options);
  assert.equal(first.cache.status, "saved");
  assert.equal(second.cache.status, "fresh");
  assert.equal(supplierCalls, 1);
  assert.equal(second.conversions.summary.all.orders, 2);
  assert.equal(second.conversions.contacts, undefined);
  const reloaded = await loadCachedBizConversions(db, "2026-10-01", "2026-10-25");
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].siteID, 2566);
});

test("forced refresh updates the snapshot and an upstream failure preserves the last good value", async () => {
  const db = new MemoryDatabase();
  await cachedBizConversions({ db, world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-25", fetcher: async () => fixture() });
  const refreshed = await cachedBizConversions({ db, world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-25", forceRefresh: true,
    fetcher: async () => ({ ...fixture("2026-10-25T09:00:00Z"), summary: { ...fixture().summary, all: { ...bucket, orders: 3 } } }) });
  assert.equal(refreshed.conversions.summary.all.orders, 3);
  const fallback = await cachedBizConversions({ db, world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-25", forceRefresh: true,
    fetcher: async () => { throw new Error("upstream down"); } });
  assert.equal(fallback.cache.status, "stale_fallback");
  assert.equal(fallback.cache.stale, true);
  assert.equal(fallback.conversions.summary.all.orders, 3);
});

test("different businesses and ranges do not share a cache key", async () => {
  const db = new MemoryDatabase();
  let calls = 0;
  const fetcher = async (siteID, from, till) => { calls += 1; return { ...fixture(), siteID, from, till }; };
  await cachedBizConversions({ db, world: "vacations", siteID: 1, from: "2026-10-01", till: "2026-10-25", fetcher: () => fetcher(1, "2026-10-01", "2026-10-25") });
  await cachedBizConversions({ db, world: "vacations", siteID: 2, from: "2026-10-01", till: "2026-10-25", fetcher: () => fetcher(2, "2026-10-01", "2026-10-25") });
  await cachedBizConversions({ db, world: "vacations", siteID: 1, from: "2026-10-02", till: "2026-10-25", fetcher: () => fetcher(1, "2026-10-02", "2026-10-25") });
  assert.equal(calls, 3);
  assert.equal(db.rows.size, 3);
});

test("a closed Biz period stays reusable for one week", async () => {
  const db = new MemoryDatabase(); let calls = 0;
  const firstNow = new Date("2026-10-25T08:00:00Z");
  await cachedBizConversions({ db, world: "vacations", siteID: 2566, from: "2026-09-01", till: "2026-09-30",
    now: firstNow, fetcher: async () => { calls += 1; return { ...fixture(), from: "2026-09-01", till: "2026-09-30" }; } });
  const later = await cachedBizConversions({ db, world: "vacations", siteID: 2566, from: "2026-09-01", till: "2026-09-30",
    now: new Date("2026-10-31T08:00:00Z"), fetcher: async () => { calls += 1; return { ...fixture(), from: "2026-09-01", till: "2026-09-30" }; } });
  assert.equal(later.cache.status, "fresh");
  assert.equal(later.cache.stale, false);
  assert.equal(calls, 1);
});

test("a period containing today still expires and refreshes", async () => {
  const db = new MemoryDatabase(); let calls = 0;
  const fetcher = async () => { calls += 1; return fixture(); };
  await cachedBizConversions({ db, world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-25",
    now: new Date("2026-10-25T08:00:00Z"), fetcher });
  await cachedBizConversions({ db, world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-25",
    now: new Date("2026-10-25T08:31:00Z"), fetcher });
  assert.equal(calls, 2);
});

test("an expired historical Biz snapshot opens immediately and refreshes in the background", async () => {
  const db = new MemoryDatabase(); let calls = 0; const deferred = [];
  let releaseRefresh;
  const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
  const fetcher = async () => {
    calls += 1;
    if (calls > 1) await refreshGate;
    return { ...fixture(), from: "2026-09-01", till: "2026-09-30" };
  };
  await cachedBizConversions({ db, world: "vacations", siteID: 2566, from: "2026-09-01", till: "2026-09-30",
    now: new Date("2026-10-01T08:00:00Z"), fetcher });
  const result = await cachedBizConversions({ db, world: "vacations", siteID: 2566, from: "2026-09-01", till: "2026-09-30",
    now: new Date("2026-10-09T08:00:00Z"), deferRefresh: (operation) => deferred.push(operation), fetcher });
  assert.equal(result.cache.status, "stale_fallback");
  assert.equal(calls, 2);
  assert.equal(deferred.length, 1);
  releaseRefresh();
  await deferred[0];
  const refreshed = await cachedBizConversions({ db, world: "vacations", siteID: 2566, from: "2026-09-01", till: "2026-09-30",
    now: new Date("2026-10-09T08:01:00Z"), fetcher });
  assert.equal(refreshed.cache.status, "fresh");
  assert.equal(calls, 2);
});
