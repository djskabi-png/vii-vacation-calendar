import test from "node:test";
import assert from "node:assert/strict";
import { cachedBizConversions, loadCachedBizConversions } from "../app/lib/biz-conversion-cache.ts";

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
    return { success: true, meta: { changes: 1 } };
  }
  async first() {
    if (/WHERE cache_key = \?/.test(this.sql)) return this.db.rows.get(this.params[0]) || null;
    return null;
  }
  async all() {
    if (/WHERE from_day = \? AND till_day = \?/.test(this.sql)) {
      return { success: true, results: [...this.db.rows.values()].filter((row) => row.fromDay === this.params[0] && row.tillDay === this.params[1]) };
    }
    return { success: true, results: [] };
  }
}

class MemoryDatabase {
  rows = new Map();
  prepare(sql) { return new MemoryStatement(this, sql); }
  async batch(statements) { return Promise.all(statements.map((statement) => statement.all())); }
}

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
