import test from "node:test";
import assert from "node:assert/strict";
import { readBizReportRuns, startBizReportRun, stopBizReportRun, updateBizReportRun } from "../app/lib/biz-report-runs.ts";

class MemoryStatement {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...params) { return new MemoryStatement(this.db, this.sql, params); }
  async run() {
    if (/INSERT INTO vii_biz_report_runs_v1/.test(this.sql)) {
      const [jobId, actorEmail, from, till, scope, forceRefresh, total, startedAt, updatedAt] = this.params;
      if (!this.db.rows.has(jobId)) this.db.rows.set(jobId, { jobId, actorEmail, from, till, scope, forceRefresh, total,
        processed: 0, succeeded: 0, failed: 0, status: "running", startedAt, updatedAt });
    } else if (/SET status = 'stopped'/.test(this.sql)) {
      const [updatedAt, jobId, actorEmail] = this.params; const row = this.db.rows.get(jobId);
      if (row?.actorEmail === actorEmail && row.status === "running") Object.assign(row, { status: "stopped", updatedAt });
    } else if (/SET processed = \?/.test(this.sql)) {
      const [processed, succeeded, failed, status, updatedAt, jobId, actorEmail, ceiling] = this.params;
      const row = this.db.rows.get(jobId);
      if (row?.actorEmail === actorEmail && row.status === "running" && row.processed <= ceiling) Object.assign(row, { processed, succeeded, failed, status, updatedAt });
    }
    return { success: true, meta: { changes: 1 } };
  }
  async all() {
    if (/SELECT job_id AS jobId/.test(this.sql)) return { success: true, results: [...this.db.rows.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, this.params[0]) };
    return { success: true, results: [] };
  }
}

class MemoryDatabase {
  rows = new Map();
  prepare(sql) { return new MemoryStatement(this, sql); }
  async batch(statements) { return Promise.all(statements.map((statement) => statement.all())); }
}

test("Biz report run history keeps actor, range and truthful progress", async () => {
  const db = new MemoryDatabase();
  const jobId = "11111111-1111-4111-8111-111111111111";
  await startBizReportRun(db, { jobId, actorEmail: "Adir@Example.com", from: "2026-10-01", till: "2026-10-25", scope: "vacations", forceRefresh: false, total: 24, now: new Date("2026-10-25T07:00:00Z") });
  await updateBizReportRun(db, { jobId, actorEmail: "adir@example.com", processed: 12, succeeded: 11, failed: 1, status: "running", now: new Date("2026-10-25T07:01:00Z") });
  await updateBizReportRun(db, { jobId, actorEmail: "adir@example.com", processed: 24, succeeded: 23, failed: 1, status: "completed", now: new Date("2026-10-25T07:02:00Z") });
  const [run] = await readBizReportRuns(db);
  assert.deepEqual({ actor: run.actorEmail, range: [run.from, run.till], scope: run.scope, status: run.status, progress: [run.processed, run.total], results: [run.succeeded, run.failed] },
    { actor: "adir@example.com", range: ["2026-10-01", "2026-10-25"], scope: "vacations", status: "completed", progress: [24, 24], results: [23, 1] });
});

test("only the owning admin can stop an active recorded run", async () => {
  const db = new MemoryDatabase();
  const jobId = "22222222-2222-4222-8222-222222222222";
  await startBizReportRun(db, { jobId, actorEmail: "liran@example.com", from: "2026-10-01", till: "2026-10-25", scope: "all", forceRefresh: true, total: 12 });
  await stopBizReportRun(db, jobId, "other@example.com");
  assert.equal((await readBizReportRuns(db))[0].status, "running");
  await stopBizReportRun(db, jobId, "liran@example.com");
  assert.equal((await readBizReportRuns(db))[0].status, "stopped");
});
