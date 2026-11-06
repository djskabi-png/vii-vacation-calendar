import type { D1Database } from "../../../types/cloudflare-runtime";
export type OutboxDb = D1Database;
export type DispatchPriority = "release" | "monitor";
export type DispatchRow = { dispatchId: string; runId: string; expectedIndex: number; sourceVersion: string; priority: DispatchPriority; status: "pending" | "sending" | "consumed" | "uncertain"; leaseToken: string | null; leaseUntil: number | null; attempts: number; createdAt: number; updatedAt: number };
const ROW = `SELECT dispatch_id AS dispatchId,run_id AS runId,expected_index AS expectedIndex,source_version AS sourceVersion,priority,status,lease_token AS leaseToken,lease_until AS leaseUntil,attempts,created_at AS createdAt,updated_at AS updatedAt FROM quality_dispatch_outbox`;

export async function ensureDispatchSchema(db: OutboxDb) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS quality_dispatch_outbox (
    dispatch_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, expected_index INTEGER NOT NULL,
    source_version TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL,
    lease_token TEXT, lease_until INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    UNIQUE(run_id, expected_index)
  )`).run();
}

export async function reserveDispatch(db: OutboxDb, input: { runId: string; expectedIndex: number; sourceVersion: string; priority: DispatchPriority; now?: number }) {
  const now = input.now ?? Date.now(); const dispatchId = `${input.runId}:${input.expectedIndex}`;
  await db.prepare(`INSERT INTO quality_dispatch_outbox(dispatch_id,run_id,expected_index,source_version,priority,status,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?) ON CONFLICT(run_id,expected_index) DO NOTHING`).bind(dispatchId, input.runId, input.expectedIndex, input.sourceVersion, input.priority, now, now).run();
  const row = await db.prepare(`${ROW} WHERE dispatch_id=?`).bind(dispatchId).first<DispatchRow>();
  if (row && (row.sourceVersion !== input.sourceVersion || row.priority !== input.priority)) throw new Error("dispatch_immutable_conflict");
  return row;
}

export async function claimDispatch(db: OutboxDb, dispatchId: string, leaseToken: string, now = Date.now(), leaseMs = 30_000) {
  const until = now + leaseMs;
  await db.prepare(`UPDATE quality_dispatch_outbox SET status='sending',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE dispatch_id=? AND status='pending' AND attempts<2`).bind(leaseToken, until, now, dispatchId).run();
  return db.prepare(`${ROW} WHERE dispatch_id=?`).bind(dispatchId).first<DispatchRow>();
}

export async function markDispatchUncertain(db: OutboxDb, dispatchId: string, leaseToken: string, now = Date.now()) {
  await db.prepare(`UPDATE quality_dispatch_outbox SET status='uncertain',lease_token=NULL,lease_until=NULL,updated_at=? WHERE dispatch_id=? AND status='sending' AND lease_token=?`).bind(now, dispatchId, leaseToken).run();
  return db.prepare(`${ROW} WHERE dispatch_id=?`).bind(dispatchId).first<DispatchRow>();
}

export async function acknowledgeDispatch(db: OutboxDb, dispatchId: string, leaseToken: string, now = Date.now()) {
  await db.prepare(`UPDATE quality_dispatch_outbox SET status='consumed',lease_token=NULL,lease_until=NULL,updated_at=? WHERE dispatch_id=? AND status='sending' AND lease_token=? AND lease_until>=?`).bind(now, dispatchId, leaseToken, now).run();
  return db.prepare(`${ROW} WHERE dispatch_id=?`).bind(dispatchId).first<DispatchRow>();
}

export async function recoverExpiredDispatches(db: OutboxDb, now = Date.now()) {
  await db.prepare(`UPDATE quality_dispatch_outbox SET status='uncertain',lease_token=NULL,lease_until=NULL,updated_at=? WHERE status='sending' AND lease_until<?`).bind(now, now).run();
}

export async function dispatchWithTransport(db: OutboxDb, dispatchId: string, leaseToken: string, send: () => Promise<void>, now = Date.now()) {
  const row = await claimDispatch(db, dispatchId, leaseToken, now);
  if (!row || row.status !== "sending" || row.leaseToken !== leaseToken) return { status: row?.status ?? "missing" as const, row };
  try { await send(); return { status: "consumed" as const, row: await acknowledgeDispatch(db, dispatchId, leaseToken, Date.now()) }; }
  catch (error) { return { status: "uncertain" as const, row: await markDispatchUncertain(db, dispatchId, leaseToken, Date.now()), error }; }
}
