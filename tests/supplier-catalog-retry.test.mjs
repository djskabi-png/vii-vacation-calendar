import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { runCatalogPullWithRetryPlan, runSupplierCatalogScheduleTick } from "../app/lib/supplier-catalog-retry-runner.ts";
import { readCatalogRetryJobs } from "../app/lib/supplier-catalog-retry.ts";

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
  const db = await database(); let calls = 0;
  const sync = async (_world, _source, runId) => { calls += 1; return { status: "rejected", id: runId, errorCode: "catalog_removal_requires_review" }; };
  try {
    await runSupplierCatalogScheduleTick(db, { now: new Date("2026-10-14T10:30:00Z"), sync });
    await runSupplierCatalogScheduleTick(db, { now: new Date("2026-10-14T10:40:00Z"), sync });
    assert.equal(calls, 1);
    const jobs = await readCatalogRetryJobs(db);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].status, "cancelled");
    assert.equal(jobs[0].resultStatus, "rejected");
  } finally { db.close(); }
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
  } finally { db.close(); }
});

test("the runtime checks durable retry work every 10 minutes", async () => {
  const config = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(config, /crons: \["\*\/10 \* \* \* \*"\]/);
});
