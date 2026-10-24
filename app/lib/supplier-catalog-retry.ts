import type { D1Database } from "../../types/cloudflare-runtime";
import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";

export const CATALOG_RETRY_DELAY_MS = 10 * 60_000;
export const CATALOG_MAX_RETRIES = 2;
export const CATALOG_RETRY_LEASE_MS = 30 * 60_000;

export type CatalogRetryJob = {
  id: string;
  rootRunId: string;
  world: SupplierCatalogWorld;
  attempt: number;
  dueAt: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  resultStatus: string | null;
  resultRunId: string | null;
  errorCode: string | null;
};

function jobId(rootRunId: string, attempt: number) {
  return `${rootRunId}_retry_${attempt}`;
}

export async function scheduleCatalogRetry(db: D1Database, input: {
  rootRunId: string;
  world: SupplierCatalogWorld;
  attempt: number;
  dueAt: string;
  createdAt: string;
}) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(input.rootRunId) || input.attempt < 1 || input.attempt > CATALOG_MAX_RETRIES
    || !Number.isFinite(Date.parse(input.dueAt)) || !Number.isFinite(Date.parse(input.createdAt))) throw new Error("invalid_catalog_retry");
  await db.prepare(`INSERT OR IGNORE INTO supplier_catalog_retry_jobs
    (id, root_run_id, world, attempt, due_at, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)`).bind(jobId(input.rootRunId, input.attempt), input.rootRunId,
      input.world, input.attempt, input.dueAt, input.createdAt).run();
}

export async function claimDueCatalogRetries(db: D1Database, now: string, limit = 4) {
  if (!Number.isFinite(Date.parse(now))) throw new Error("invalid_catalog_retry_time");
  await reconcileStaleCatalogRetries(db, now);
  const rows = await db.prepare(`SELECT id, root_run_id AS rootRunId, world, attempt, due_at AS dueAt,
    status, created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt,
    result_status AS resultStatus, result_run_id AS resultRunId, error_code AS errorCode
    FROM supplier_catalog_retry_jobs WHERE status = 'pending' AND due_at <= ? ORDER BY due_at, id LIMIT ?`)
    .bind(now, Math.max(1, Math.min(8, limit))).all<CatalogRetryJob>();
  const claimed: CatalogRetryJob[] = [];
  for (const row of rows.results) {
    const result = await db.prepare(`UPDATE supplier_catalog_retry_jobs SET status = 'running', started_at = ?
      WHERE id = ? AND status = 'pending'`).bind(now, row.id).run();
    if (result.meta.changes === 1) claimed.push({ ...row, status: "running", startedAt: now });
  }
  return claimed;
}

/**
 * A Worker may be interrupted after claiming a retry. Never execute that
 * uncertain operation again blindly. Reconcile a durable terminal run when
 * one exists; otherwise close the expired lease as exhausted and surface it.
 */
export async function reconcileStaleCatalogRetries(db: D1Database, now: string) {
  if (!Number.isFinite(Date.parse(now))) throw new Error("invalid_catalog_retry_time");
  const cutoff = new Date(Date.parse(now) - CATALOG_RETRY_LEASE_MS).toISOString();
  const stale = await db.prepare(`SELECT id, root_run_id AS rootRunId, world, attempt, due_at AS dueAt,
    status, created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt,
    result_status AS resultStatus, result_run_id AS resultRunId, error_code AS errorCode
    FROM supplier_catalog_retry_jobs WHERE status = 'running' AND started_at <= ? ORDER BY started_at, id LIMIT 20`)
    .bind(cutoff).all<CatalogRetryJob>();
  for (const job of stale.results) {
    const runId = `${job.rootRunId}_retry_${job.attempt}`;
    const run = await db.prepare("SELECT status, error_code AS errorCode FROM supplier_catalog_runs WHERE id = ? AND world = ?")
      .bind(runId, job.world).first<{ status: string; errorCode: string | null }>();
    const resultStatus = run?.status && ["accepted", "rejected", "failed"].includes(run.status)
      ? run.status : "interrupted";
    const status = resultStatus === "rejected" ? "cancelled"
      : resultStatus === "failed" && job.attempt >= CATALOG_MAX_RETRIES ? "exhausted"
        : resultStatus === "interrupted" ? "exhausted" : "completed";
    await finishCatalogRetry(db, { id: job.id, status, finishedAt: now, resultStatus,
      resultRunId: run ? runId : undefined, errorCode: run?.errorCode || "retry_lease_expired" });
    if (resultStatus === "accepted" || resultStatus === "rejected") {
      await cancelPendingCatalogRetries(db, job.rootRunId, now, resultStatus, runId, run?.errorCode || undefined);
    }
  }
  return stale.results.length;
}

export async function finishCatalogRetry(db: D1Database, input: {
  id: string;
  status: "completed" | "cancelled" | "exhausted";
  finishedAt: string;
  resultStatus: string;
  resultRunId?: string;
  errorCode?: string;
}) {
  await db.prepare(`UPDATE supplier_catalog_retry_jobs SET status = ?, finished_at = ?, result_status = ?,
    result_run_id = ?, error_code = ? WHERE id = ? AND status = 'running'`).bind(input.status, input.finishedAt,
      input.resultStatus.slice(0, 30), input.resultRunId || null, input.errorCode?.slice(0, 100) || null, input.id).run();
}

export async function cancelPendingCatalogRetries(db: D1Database, rootRunId: string, finishedAt: string,
  resultStatus: string, resultRunId?: string, errorCode?: string) {
  await db.prepare(`UPDATE supplier_catalog_retry_jobs SET status = 'cancelled', finished_at = ?, result_status = ?,
    result_run_id = ?, error_code = ? WHERE root_run_id = ? AND status = 'pending'`).bind(finishedAt,
      resultStatus.slice(0, 30), resultRunId || null, errorCode?.slice(0, 100) || null, rootRunId).run();
}

export async function readCatalogRetryJobs(db: D1Database) {
  const rows = await db.prepare(`SELECT id, root_run_id AS rootRunId, world, attempt, due_at AS dueAt,
    status, created_at AS createdAt, started_at AS startedAt, finished_at AS finishedAt,
    result_status AS resultStatus, result_run_id AS resultRunId, error_code AS errorCode
    FROM supplier_catalog_retry_jobs ORDER BY created_at DESC, attempt DESC LIMIT 40`).all<CatalogRetryJob>();
  return rows.results;
}
