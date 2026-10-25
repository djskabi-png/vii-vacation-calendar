import assert from "node:assert/strict";
import test from "node:test";
import { cachedAdminReport } from "../app/lib/admin-report-cache.ts";

class Statement {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...params) { return new Statement(this.db, this.sql, params); }
  async first() { return this.db.rows.get(this.params[0]) || null; }
  async all() { return { success: true, results: [] }; }
  async run() {
    if (this.db.failWrite && /INSERT INTO vii_admin_report_cache_v1/.test(this.sql)) throw new Error("write failed");
    if (/INSERT INTO vii_admin_report_cache_v1/.test(this.sql)) {
      const [key, family, parameters, payload, savedAt, freshUntil, staleUntil] = this.params;
      this.db.rows.set(key, { family, parameters, payload, savedAt, freshUntil, staleUntil });
    }
    return { success: true, meta: { changes: 1 } };
  }
}
class Database {
  rows = new Map();
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) { return Promise.all(statements.map((statement) => statement.all())); }
}

test("identical report parameters reuse the persistent snapshot", async () => {
  const db = new Database(); let calls = 0;
  const options = { db, family: "business-performance", parameters: { till: "2026-10-01", from: "2026-09-01" },
    freshForMs: 3600_000, now: new Date("2026-10-25T08:00:00Z"), loader: async () => ({ calls: ++calls }) };
  const first = await cachedAdminReport(options);
  const second = await cachedAdminReport({ ...options, parameters: { from: "2026-09-01", till: "2026-10-01" } });
  assert.equal(first.cache.status, "saved");
  assert.equal(second.cache.status, "fresh");
  assert.equal(second.value.calls, 1);
  assert.equal(calls, 1);
});

test("forced refresh replaces data and failed refresh returns the last good report", async () => {
  const db = new Database();
  const base = { db, family: "search-analytics", parameters: { days: 30 }, freshForMs: 1,
    now: new Date("2026-10-25T08:00:00Z") };
  await cachedAdminReport({ ...base, loader: async () => ({ total: 10 }) });
  const refreshed = await cachedAdminReport({ ...base, forceRefresh: true, loader: async () => ({ total: 11 }) });
  assert.equal(refreshed.value.total, 11);
  const fallback = await cachedAdminReport({ ...base, forceRefresh: true, loader: async () => { throw new Error("source down"); } });
  assert.equal(fallback.value.total, 11);
  assert.equal(fallback.cache.status, "stale_fallback");
});

test("report remains available when persistent cache setup fails", async () => {
  const db = new Database();
  db.batch = async () => { throw new Error("cache unavailable"); };
  const result = await cachedAdminReport({ db, family: "business-performance", parameters: { from: "2026-10-25" },
    freshForMs: 60_000, loader: async () => ({ rows: [{ placeId: "vacation-1" }] }) });
  assert.equal(result.cache.status, "bypassed");
  assert.equal(result.value.rows[0].placeId, "vacation-1");
});

test("report remains available when persistent cache write fails", async () => {
  const db = new Database();
  db.failWrite = true;
  const result = await cachedAdminReport({ db, family: "business-performance", parameters: { from: "2026-10-24" },
    freshForMs: 60_000, loader: async () => ({ rows: [{ placeId: "vacation-2" }] }) });
  assert.equal(result.cache.status, "bypassed");
  assert.equal(result.value.rows[0].placeId, "vacation-2");
});

test("immutable historical report is reused after its original freshness window", async () => {
  const db = new Database(); let calls = 0;
  await cachedAdminReport({ db, family: "business-performance", parameters: { from: "2026-09-01", till: "2026-09-30" },
    freshForMs: 1, immutable: true, now: new Date("2026-10-01T08:00:00Z"), loader: async () => ({ calls: ++calls }) });
  const later = await cachedAdminReport({ db, family: "business-performance", parameters: { from: "2026-09-01", till: "2026-09-30" },
    freshForMs: 1, immutable: true, now: new Date("2027-10-01T08:00:00Z"), loader: async () => ({ calls: ++calls }) });
  assert.equal(later.cache.status, "fresh");
  assert.equal(later.value.calls, 1);
  assert.equal(calls, 1);
});

test("explicit refresh can replace an immutable historical report", async () => {
  const db = new Database();
  const base = { db, family: "business-performance", parameters: { from: "2026-09-01", till: "2026-09-30" },
    freshForMs: 1, immutable: true, now: new Date("2026-10-01T08:00:00Z") };
  await cachedAdminReport({ ...base, loader: async () => ({ total: 10 }) });
  const result = await cachedAdminReport({ ...base, forceRefresh: true, loader: async () => ({ total: 12 }) });
  assert.equal(result.value.total, 12);
  assert.equal(result.cache.status, "saved");
});

test("expired report can return immediately while one deferred refresh replaces it", async () => {
  const db = new Database(); let calls = 0; const deferred = [];
  let releaseRefresh;
  const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
  const parameters = { from: "2026-09-01", till: "2026-09-30" };
  await cachedAdminReport({ db, family: "business-conversions", parameters, freshForMs: 1,
    now: new Date("2026-10-01T08:00:00Z"), loader: async () => ({ total: ++calls }) });
  const result = await cachedAdminReport({ db, family: "business-conversions", parameters, freshForMs: 1,
    now: new Date("2026-10-02T08:00:00Z"), deferRefresh: (operation) => deferred.push(operation),
    loader: async () => { calls += 1; await refreshGate; return { total: calls }; } });
  assert.equal(result.cache.status, "stale_fallback");
  assert.equal(result.value.total, 1);
  assert.equal(deferred.length, 1);
  releaseRefresh();
  await deferred[0];
  const refreshed = await cachedAdminReport({ db, family: "business-conversions", parameters, freshForMs: 3600_000,
    now: new Date("2026-10-02T08:00:00Z"), loader: async () => ({ total: ++calls }) });
  assert.equal(refreshed.value.total, 2);
  assert.equal(calls, 2);
});
