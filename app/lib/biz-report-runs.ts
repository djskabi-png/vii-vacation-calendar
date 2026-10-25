import type { D1Database } from "../../types/cloudflare-runtime";

export type BizReportRunStatus = "running" | "completed" | "stopped";
export type BizReportRun = {
  jobId: string;
  actorEmail: string;
  from: string;
  till: string;
  scope: string;
  forceRefresh: boolean;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  status: BizReportRunStatus;
  startedAt: string;
  updatedAt: string;
};

const initialized = new WeakMap<object, Promise<void>>();

export async function ensureBizReportRunSchema(db: D1Database) {
  const existing = initialized.get(db as object);
  if (existing) return existing;
  const operation = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_biz_report_runs_v1 (
      job_id TEXT PRIMARY KEY NOT NULL, actor_email TEXT NOT NULL,
      from_day TEXT NOT NULL, till_day TEXT NOT NULL, scope TEXT NOT NULL,
      force_refresh INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL,
      processed INTEGER NOT NULL DEFAULT 0, succeeded INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL,
      started_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_biz_report_runs_actor_time ON vii_biz_report_runs_v1(actor_email, started_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_biz_report_runs_time ON vii_biz_report_runs_v1(started_at)"),
  ]).then(() => undefined).catch((error) => { initialized.delete(db as object); throw error; });
  initialized.set(db as object, operation);
  return operation;
}

type RunRow = {
  jobId: string; actorEmail: string; from: string; till: string; scope: string;
  forceRefresh: number; total: number; processed: number; succeeded: number;
  failed: number; status: BizReportRunStatus; startedAt: string; updatedAt: string;
};

const decode = (row: RunRow): BizReportRun => ({ ...row, forceRefresh: Number(row.forceRefresh) === 1,
  total: Number(row.total), processed: Number(row.processed), succeeded: Number(row.succeeded), failed: Number(row.failed) });

export async function readBizReportRuns(db: D1Database, limit = 20) {
  await ensureBizReportRunSchema(db);
  const bounded = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await db.prepare(`SELECT job_id AS jobId, actor_email AS actorEmail,
    from_day AS "from", till_day AS till, scope, force_refresh AS forceRefresh,
    total, processed, succeeded, failed_count AS failed, status,
    started_at AS startedAt, updated_at AS updatedAt
    FROM vii_biz_report_runs_v1 ORDER BY started_at DESC, job_id DESC LIMIT ?`)
    .bind(bounded).all<RunRow>();
  return rows.results.map(decode);
}

export async function startBizReportRun(db: D1Database, input: {
  jobId: string; actorEmail: string; from: string; till: string; scope: string;
  forceRefresh: boolean; total: number; now?: Date;
}) {
  await ensureBizReportRunSchema(db);
  const now = (input.now ?? new Date()).toISOString();
  await db.prepare(`INSERT INTO vii_biz_report_runs_v1
    (job_id, actor_email, from_day, till_day, scope, force_refresh, total,
      processed, succeeded, failed_count, status, started_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'running', ?, ?)
    ON CONFLICT(job_id) DO NOTHING`)
    .bind(input.jobId, input.actorEmail.trim().toLowerCase(), input.from, input.till,
      input.scope, input.forceRefresh ? 1 : 0, input.total, now, now).run();
}

export async function updateBizReportRun(db: D1Database, input: {
  jobId: string; actorEmail: string; processed: number; succeeded: number; failed: number;
  status: BizReportRunStatus; now?: Date;
}) {
  const now = (input.now ?? new Date()).toISOString();
  await db.prepare(`UPDATE vii_biz_report_runs_v1 SET processed = ?, succeeded = ?,
    failed_count = ?, status = ?, updated_at = ?
    WHERE job_id = ? AND actor_email = ? AND status = 'running' AND processed <= ?`)
    .bind(input.processed, input.succeeded, input.failed, input.status, now,
      input.jobId, input.actorEmail.trim().toLowerCase(), input.processed).run();
}

export async function stopBizReportRun(db: D1Database, jobId: string, actorEmail: string, now = new Date()) {
  await db.prepare(`UPDATE vii_biz_report_runs_v1 SET status = 'stopped', updated_at = ?
    WHERE job_id = ? AND actor_email = ? AND status = 'running'`)
    .bind(now.toISOString(), jobId, actorEmail.trim().toLowerCase()).run();
}
