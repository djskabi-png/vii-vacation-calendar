import type { D1Database } from "../../types/cloudflare-runtime";
import { initializeSchemaOnce } from "./schema-initializer.ts";

export type QualityJobStatus = "queued" | "running" | "completed" | "blocked" | "cancelled";
export type QualityJobCheck = { checkId: string; definitionVersion: string; timeoutMs?: number; configuration: Record<string, unknown> };
export type QualityJobReceipt = { checkId: string; status: "passed" | "failed" | "degraded" | "blocked"; observed: string; checkedAt: string; statusCode?: number | null; durationMs?: number; evidenceUrl?: string; evidenceValidUntil?: string };
export type QualityJob = {
  runId: string; actor: string; idempotencyKey: string; payloadHash: string; sourceVersion: string;
  definitionVersion: string; checks: QualityJobCheck[]; expectedCheckIds: string[]; receipts: QualityJobReceipt[];
  nextIndex: number; activeIndex: number | null; status: QualityJobStatus; leaseToken: string | null;
  leaseUntil: string | null; cancelRequestedAt: string | null; reason: string | null; createdAt: string; updatedAt: string;
};

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined || typeof value === "number" && !Number.isFinite(value)) throw new Error("invalid_quality_job_payload");
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

export async function payloadHash(payload: unknown) {
  const encoded = stable(payload);
  if (encoded.length > 1_000_000) throw new Error("quality_job_payload_too_large");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(encoded));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function ensureQualityJobSchema(db: D1Database) {
  return initializeSchemaOnce(db, "quality-jobs-v1", async () => {
    await db.prepare(`CREATE TABLE IF NOT EXISTS quality_jobs (
      run_id TEXT PRIMARY KEY, actor TEXT NOT NULL, idempotency_key TEXT NOT NULL, payload_hash TEXT NOT NULL,
      source_version TEXT NOT NULL, definition_version TEXT NOT NULL, checks_json TEXT NOT NULL,
      next_index INTEGER NOT NULL DEFAULT 0, active_index INTEGER, receipts_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL, lease_token TEXT, lease_until TEXT, cancel_requested_at TEXT, reason TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(actor,idempotency_key))`).run();
    await db.prepare("CREATE INDEX IF NOT EXISTS quality_jobs_due ON quality_jobs(status,lease_until,created_at)").run();
  });
}

type Row = Omit<QualityJob, "checks" | "expectedCheckIds" | "receipts"> & { checksJson: string; receiptsJson: string };
export const qualityJobSelectSql = `SELECT run_id AS runId,actor,idempotency_key AS idempotencyKey,payload_hash AS payloadHash,
  source_version AS sourceVersion,definition_version AS definitionVersion,checks_json AS checksJson,
  receipts_json AS receiptsJson,next_index AS nextIndex,active_index AS activeIndex,status,
  lease_token AS leaseToken,lease_until AS leaseUntil,cancel_requested_at AS cancelRequestedAt,reason,created_at AS createdAt,updated_at AS updatedAt FROM quality_jobs`;
const select = qualityJobSelectSql;
function decode(row: Row | null): QualityJob | null {
  if (!row) return null;
  const { checksJson, receiptsJson, ...rest } = row;
  const checks = JSON.parse(checksJson) as QualityJobCheck[];
  return { ...rest, checks, expectedCheckIds: checks.map(check => check.checkId), receipts: JSON.parse(receiptsJson) };
}

export async function enqueueQualityJob(db: D1Database, input: {
  actor: string; idempotencyKey: string; payload: unknown; sourceVersion: string;
  definitionVersion: string; checks: readonly QualityJobCheck[]; now?: string;
}) {
  if (!input.actor || input.actor.length > 320 || !/^[A-Za-z0-9:_-]{8,120}$/.test(input.idempotencyKey)
    || !input.sourceVersion || input.sourceVersion.length > 160 || !input.definitionVersion || !input.checks.length || input.checks.length > 1000
    || input.checks.some(check => !check.checkId || !check.definitionVersion || !check.configuration || Array.isArray(check.configuration))
    || new Set(input.checks.map(check => check.checkId)).size !== input.checks.length) throw new Error("invalid_quality_job");
  const now = input.now ?? new Date().toISOString();
  // Server-selected source and definitions are immutable. A new explicit key
  // permits a deliberate repeat run; a conflicting retry cannot change scope.
  const hash = await payloadHash({ payload: input.payload, sourceVersion: input.sourceVersion, definitionVersion: input.definitionVersion, checks: input.checks });
  await ensureQualityJobSchema(db);
  const runId = crypto.randomUUID();
  const inserted = await db.prepare(`INSERT OR IGNORE INTO quality_jobs
    (run_id,actor,idempotency_key,payload_hash,source_version,definition_version,checks_json,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,'queued',?,?)`).bind(runId, input.actor, input.idempotencyKey, hash,
      input.sourceVersion, input.definitionVersion, JSON.stringify(input.checks), now, now).run();
  const job = decode(await db.prepare(`${select} WHERE actor=? AND idempotency_key=?`).bind(input.actor, input.idempotencyKey).first<Row>());
  if (!job) throw new Error("quality_job_enqueue_not_verified");
  if (job.payloadHash !== hash) throw new Error("quality_job_idempotency_conflict");
  return { job, duplicate: Number(inserted.meta?.changes ?? 0) !== 1 };
}

export async function readQualityJob(db: D1Database, runId: string) {
  return decode(await db.prepare(`${select} WHERE run_id=?`).bind(runId).first<Row>());
}

export async function readQualityJobByIntent(db:D1Database,actor:string,idempotencyKey:string, options: { initializeSchema?: boolean } = {}) {
  if (options.initializeSchema !== false) await ensureQualityJobSchema(db);
  return decode(await db.prepare(`${select} WHERE actor=? AND idempotency_key=?`).bind(actor,idempotencyKey).first<Row>());
}

export async function dueQualityJobIds(db: D1Database, now = new Date().toISOString(), limit = 2) {
  await ensureQualityJobSchema(db);
  const rows = await db.prepare(`SELECT run_id AS runId FROM quality_jobs WHERE cancel_requested_at IS NULL
    AND (status='queued' OR (status='running' AND lease_until<=?)) ORDER BY created_at,run_id LIMIT ?`)
    .bind(now, Math.max(1, Math.min(2, Math.trunc(limit)))).all<{ runId: string }>();
  return rows.results.map(row => row.runId);
}

export async function claimQualityJob(db: D1Database, runId: string, input: { leaseToken: string; leaseUntil: string; now: string }) {
  if (!input.leaseToken || !Number.isFinite(Date.parse(input.now)) || !Number.isFinite(Date.parse(input.leaseUntil)) || Date.parse(input.leaseUntil) <= Date.parse(input.now)) return false;
  const result = await db.prepare(`UPDATE quality_jobs SET status='running',lease_token=?,lease_until=?,updated_at=?
    WHERE run_id=? AND status IN ('queued','running') AND cancel_requested_at IS NULL
    AND (status='queued' OR lease_until<=?)`).bind(input.leaseToken, input.leaseUntil, input.now, runId, input.now).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export async function requestQualityJobCancel(db: D1Database, runId: string, now = new Date().toISOString()) {
  await db.prepare(`UPDATE quality_jobs SET cancel_requested_at=?,status='cancelled',lease_token=NULL,lease_until=NULL,updated_at=?
    WHERE run_id=? AND status IN ('queued','running')`).bind(now, now, runId).run();
}

export async function startQualityJobCheck(db: D1Database, input: { runId: string; leaseToken: string; index: number; now: string }) {
  const result = await db.prepare(`UPDATE quality_jobs SET active_index=?,updated_at=? WHERE run_id=? AND status='running'
    AND lease_token=? AND lease_until>? AND cancel_requested_at IS NULL AND next_index=? AND active_index IS NULL`)
    .bind(input.index, input.now, input.runId, input.leaseToken, input.now, input.index).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

/** Receipt and cursor advance together in one fenced write. A crash before
 * commit leaves active_index set. Resume blocks as interrupted instead of
 * silently replaying a possibly completed check or reporting it green. */
export async function commitQualityJobCheck(db: D1Database, input: {
  runId: string; leaseToken: string; index: number; receipt: QualityJobReceipt; now: string;
}) {
  if (typeof input.receipt.observed !== "string" || input.receipt.observed.length > 4000 || !["passed", "failed", "degraded", "blocked"].includes(input.receipt.status)) throw new Error("invalid_quality_receipt");
  const result = await db.prepare(`UPDATE quality_jobs SET next_index=next_index+1,active_index=NULL,
    receipts_json=json_insert(receipts_json,'$[#]',json(?)),updated_at=? WHERE run_id=? AND status='running'
    AND lease_token=? AND lease_until>? AND cancel_requested_at IS NULL AND next_index=? AND active_index=?
    AND json_extract(checks_json,'$[' || next_index || '].checkId')=?`)
    .bind(JSON.stringify(input.receipt), input.now, input.runId, input.leaseToken, input.now, input.index, input.index, input.receipt.checkId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export async function finishQualityJobSlice(db: D1Database, input: {
  runId: string; leaseToken: string; status: "queued" | "completed" | "blocked"; reason?: string; now: string;
}) {
  const result = await db.prepare(`UPDATE quality_jobs SET status=?,reason=?,lease_token=NULL,lease_until=NULL,updated_at=?
    WHERE run_id=? AND status='running' AND lease_token=? AND lease_until>? AND cancel_requested_at IS NULL
    AND (?<>'completed' OR (next_index=json_array_length(checks_json) AND active_index IS NULL))`)
    .bind(input.status, input.reason ?? null, input.now, input.runId, input.leaseToken, input.now, input.status).run();
  return Number(result.meta?.changes ?? 0) === 1;
}
