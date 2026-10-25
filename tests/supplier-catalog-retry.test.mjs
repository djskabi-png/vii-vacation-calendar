import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { runCatalogPullWithRetryPlan, runSupplierCatalogScheduleTick } from "../app/lib/supplier-catalog-retry-runner.ts";
import { claimDueCatalogRetries, readCatalogRetryJobs, scheduleCatalogRetry } from "../app/lib/supplier-catalog-retry.ts";
import { catalogFreshnessAlerts, readCatalogAlerts } from "../app/lib/supplier-catalog-alerts.ts";
import { supplierDetailRefreshLimit } from "../app/lib/supplier-catalog-runtime.ts";

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const name of ["0002_sour_tigra", "0003_catalog_diagnostics", "0007_catalog_retry_queue"]) {
    const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
    for (const sql of source.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) sqlite.exec(sql);
  }
  const prepare = (sql) => { let values = []; return { bind(...args) { values = args; return this; },
    async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; },
    async first() { return sqlite.prepare(sql).get(...values) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; };
  return { prepare, async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); }, close: () => sqlite.close() };
}

test("a temporary supplier failure retries after 10 minutes and once more after another 10 minutes", async () => {
  const db = await database(); const calls = [];
  const sync = async (world, source, runId) => {
    calls.push({ world, source, runId });
    return calls.length < 3 ? { status: "failed", id: runId, errorCode: "spa_transport_error" } : { status: "accepted", id: runId };
  };
  try {
    const first = new Date("2026-10-14T10:30:00Z"); // 13:30 in Israel, the Spa slot.
    const initial = await runSupplierCatalogScheduleTick(db, { now: first, sync });
    assert.equal(initial.primary.status, "failed");
    let jobs = await readCatalogRetryJobs(db);
    assert.equal(jobs.filter((job) => job.status === "pending").length, 1);
    assert.equal(jobs.find((job) => job.status === "pending").dueAt, "2026-10-14T10:40:00.000Z");

    await runSupplierCatalogScheduleTick(db, { now: new Date("2026-10-14T10:40:00Z"), sync });
    jobs = await readCatalogRetryJobs(db);
    assert.equal(jobs.find((job) => job.status === "pending").attempt, 2);
    assert.equal(jobs.find((job) => job.status === "pending").dueAt, "2026-10-14T10:50:00.000Z");

    await runSupplierCatalogScheduleTick(db, { now: new Date("2026-10-14T10:50:00Z"), sync });
    jobs = await readCatalogRetryJobs(db);
    assert.equal(jobs.some((job) => job.status === "pending" || job.status === "running"), false);
    assert.deepEqual(calls.map((call) => call.source), ["scheduled", "retry", "retry"]);
    assert.equal(calls[1].runId.endsWith("_retry_1"), true);
    assert.equal(calls[2].runId.endsWith("_retry_2"), true);
  } finally { db.close(); }
});

test("safety rejection is never retried automatically", async () => {
  const db = await database(); const calls = [];
  const sync = async (world, source, runId) => { calls.push({ world, source, runId }); return { status: "rejected", id: runId, errorCode: "catalog_removal_requires_review" }; };
  try {
    await runSupplierCatalogScheduleTick(db, { now: new Date("2026-10-14T10:30:00Z"), sync });
    await runSupplierCatalogScheduleTick(db, { now: new Date("2026-10-14T10:40:00Z"), sync });
    assert.equal(calls.filter((call) => call.world === "spa").length, 1, "the rejected Spa slot must not be retried");
    assert.equal(calls.some((call) => call.world !== "spa"), true, "an unrelated missed-slot recovery may still run");
    const jobs = await readCatalogRetryJobs(db);
    const spaJobs = jobs.filter((job) => job.world === "spa");
    assert.equal(spaJobs.length, 1);
    assert.equal(spaJobs[0].status, "cancelled");
    assert.equal(spaJobs[0].resultStatus, "rejected");
    const alerts = await readCatalogAlerts(db);
    const spaAlerts = alerts.filter((alert) => alert.world === "spa");
    assert.equal(spaAlerts.length, 1);
    assert.equal(spaAlerts[0].kind, "review_required");
    assert.equal(spaAlerts[0].severity, "warning");
  } finally { db.close(); }
});

test("a delayed ten-minute tick recovers one latest supplier slot without caller-selected dates", async () => {
  const db = await database(); const calls = [];
  const sync = async (world, source, runId) => { calls.push({ world, source, runId }); return { status: "accepted", id: runId }; };
  try {
    const result = await runSupplierCatalogScheduleTick(db, { now: new Date("2026-10-14T10:40:00Z"), sync });
    assert.equal(result.scheduled.length, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].source, "scheduled");
    assert.match(calls[0].runId, /^mcp_20261014_/);
  } finally { db.close(); }
});

test("a visitor heartbeat recovers its requested world without waiting for that minute bucket", async () => {
  const db = await database(); const calls = [];
  const sync = async (world, source, runId) => { calls.push({ world, source, runId }); return { status: "accepted", id: runId }; };
  try {
    await runSupplierCatalogScheduleTick(db, {
      now: new Date("2026-10-14T10:40:00Z"), preferredWorld: "spa", sync,
    });
    assert.deepEqual(calls, [{ world: "spa", source: "scheduled", runId: "mcp_20261014_spa_1330_heartbeat_2986624" }]);
  } finally { db.close(); }
});

test("a visitor heartbeat is not suppressed by unrelated retry backlog", async () => {
  const db = await database(); const calls = [];
  const sync = async (world, source, runId) => { calls.push({ world, source, runId }); return { status: "accepted", id: runId }; };
  try {
    await scheduleCatalogRetry(db, { rootRunId: "old_vacations_failure", world: "vacations", attempt: 1,
      dueAt: "2026-10-14T10:30:00.000Z", createdAt: "2026-10-14T10:20:00.000Z" });
    await runSupplierCatalogScheduleTick(db, {
      now: new Date("2026-10-14T10:40:00Z"), preferredWorld: "spa", sync,
    });
    assert.deepEqual(calls.map(({ world, source }) => ({ world, source })), [
      { world: "vacations", source: "retry" },
      { world: "spa", source: "scheduled" },
    ]);
  } finally { db.close(); }
});

test("automatic vacation refreshes use a bounded rotating detail batch", () => {
  assert.equal(supplierDetailRefreshLimit("vacations", "scheduled"), 8);
  assert.equal(supplierDetailRefreshLimit("vacations", "retry"), 8);
  assert.equal(supplierDetailRefreshLimit("vacations", "manual"), undefined);
  assert.equal(supplierDetailRefreshLimit("events", "scheduled"), undefined);
});

test("two failed retries exhaust the bounded retry budget and preserve an auditable record", async () => {
  const db = await database();
  const sync = async (_world, _source, runId) => ({ status: "failed", id: runId, errorCode: "supplier_sync_failed" });
  try {
    await runCatalogPullWithRetryPlan(db, { world: "spa", source: "manual", runId: "manual_retry_fixture", now: new Date("2026-10-14T10:00:00Z"), sync });
    await runSupplierCatalogScheduleTick(db, { now: new Date("2026-10-14T10:10:00Z"), sync });
    await runSupplierCatalogScheduleTick(db, { now: new Date("2026-10-14T10:20:00Z"), sync });
    const jobs = await readCatalogRetryJobs(db);
    assert.equal(jobs.length, 2);
    assert.equal(jobs.find((job) => job.attempt === 2).status, "exhausted");
    assert.equal(jobs.some((job) => job.status === "pending"), false);
    const alerts = await readCatalogAlerts(db);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].kind, "retries_exhausted");
    assert.equal(alerts[0].severity, "critical");
  } finally { db.close(); }
});

test("the runtime checks durable retry work every 10 minutes", async () => {
  const config = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(config, /crons: \["\*\/10 \* \* \* \*"\]/);
});

test("public vacation routes select the vacations heartbeat for both route spellings", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /\(\?:vacations\?\|business\)/);
});

test("an expired running retry is closed without blindly repeating an uncertain supplier pull", async () => {
  const db = await database();
  try {
    await scheduleCatalogRetry(db, { rootRunId: "manual_stale_fixture", world: "vacations", attempt: 1,
      dueAt: "2026-10-14T10:00:00.000Z", createdAt: "2026-10-14T09:50:00.000Z" });
    assert.equal((await claimDueCatalogRetries(db, "2026-10-14T10:00:00.000Z", 1)).length, 1);
    assert.equal((await claimDueCatalogRetries(db, "2026-10-14T10:31:00.000Z", 1)).length, 0);
    const jobs = await readCatalogRetryJobs(db);
    assert.equal(jobs[0].status, "exhausted");
    assert.equal(jobs[0].resultStatus, "interrupted");
    assert.equal(jobs[0].errorCode, "retry_lease_expired");
  } finally { db.close(); }
});

test("stale retry reconciliation cancels a queued follow-up when the durable run already succeeded", async () => {
  const db = await database();
  try {
    const rootRunId = "manual_stale_accepted";
    await scheduleCatalogRetry(db, { rootRunId, world: "vacations", attempt: 1,
      dueAt: "2026-10-14T10:00:00.000Z", createdAt: "2026-10-14T09:50:00.000Z" });
    await scheduleCatalogRetry(db, { rootRunId, world: "vacations", attempt: 2,
      dueAt: "2026-10-14T10:20:00.000Z", createdAt: "2026-10-14T10:00:00.000Z" });
    assert.equal((await claimDueCatalogRetries(db, "2026-10-14T10:00:00.000Z", 1)).length, 1);
    await db.prepare(`INSERT INTO supplier_catalog_runs (id, world, source, status, started_at, finished_at)
      VALUES (?, 'vacations', 'retry', 'accepted', ?, ?)`).bind(`${rootRunId}_retry_1`,
        "2026-10-14T10:00:00.000Z", "2026-10-14T10:01:00.000Z").run();
    await claimDueCatalogRetries(db, "2026-10-14T10:31:00.000Z", 1);
    const jobs = await readCatalogRetryJobs(db);
    assert.equal(jobs.find((job) => job.attempt === 1).status, "completed");
    assert.equal(jobs.find((job) => job.attempt === 2).status, "cancelled");
  } finally { db.close(); }
});

test("dashboard derives a critical freshness alert after 24 hours and clears it after a current publication", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  assert.equal(catalogFreshnessAlerts([{ world: "spa", acceptedAt: "2026-10-19T11:59:59Z" }], now).length, 1);
  assert.equal(catalogFreshnessAlerts([{ world: "spa", acceptedAt: "2026-10-20T11:00:00Z" }], now).length, 0);
});
