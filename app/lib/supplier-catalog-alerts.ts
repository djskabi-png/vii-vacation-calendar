import type { D1Database } from "../../types/cloudflare-runtime";
import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";

export type CatalogAlert = {
  id: string; fingerprint: string; world: SupplierCatalogWorld; severity: "warning" | "critical";
  kind: "review_required" | "retries_exhausted" | "stale"; status: "open" | "resolved";
  runId: string | null; errorCode: string | null; firstSeenAt: string; lastSeenAt: string; resolvedAt: string | null;
};

const schema = [
  `CREATE TABLE IF NOT EXISTS supplier_catalog_alerts (
    id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, world TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('warning','critical')),
    kind TEXT NOT NULL CHECK(kind IN ('review_required','retries_exhausted')),
    status TEXT NOT NULL CHECK(status IN ('open','resolved')),
    run_id TEXT, error_code TEXT, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, resolved_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS supplier_catalog_alerts_status_time ON supplier_catalog_alerts(status,last_seen_at DESC)`,
] as const;

export async function ensureCatalogAlertSchema(db: D1Database) {
  await db.batch(schema.map((statement) => db.prepare(statement)));
}

export async function recordCatalogAlert(db: D1Database, input: {
  rootRunId: string; runId: string; world: SupplierCatalogWorld; severity: "warning" | "critical";
  kind: "review_required" | "retries_exhausted"; errorCode?: string; now: string;
}) {
  await ensureCatalogAlertSchema(db);
  const fingerprint = `${input.world}:${input.rootRunId}:${input.kind}`;
  await db.prepare(`INSERT INTO supplier_catalog_alerts
    (id,fingerprint,world,severity,kind,status,run_id,error_code,first_seen_at,last_seen_at,resolved_at)
    VALUES (?,?,?,?,?,'open',?,?,?,?,NULL)
    ON CONFLICT(fingerprint) DO UPDATE SET severity=excluded.severity,status='open',run_id=excluded.run_id,
      error_code=excluded.error_code,last_seen_at=excluded.last_seen_at,resolved_at=NULL`)
    .bind(crypto.randomUUID(), fingerprint, input.world, input.severity, input.kind, input.runId,
      input.errorCode?.slice(0, 100) || null, input.now, input.now).run();
}

export async function resolveCatalogAlerts(db: D1Database, world: SupplierCatalogWorld, now: string) {
  await ensureCatalogAlertSchema(db);
  await db.prepare(`UPDATE supplier_catalog_alerts SET status='resolved',resolved_at=?,last_seen_at=?
    WHERE world=? AND status='open'`).bind(now, now, world).run();
}

export async function readCatalogAlerts(db: D1Database) {
  await ensureCatalogAlertSchema(db);
  const rows = await db.prepare(`SELECT id,fingerprint,world,severity,kind,status,run_id AS runId,
    error_code AS errorCode,first_seen_at AS firstSeenAt,last_seen_at AS lastSeenAt,resolved_at AS resolvedAt
    FROM supplier_catalog_alerts ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,last_seen_at DESC LIMIT 80`).all<CatalogAlert>();
  return rows.results;
}

export function catalogFreshnessAlerts(states: Array<{ world: SupplierCatalogWorld; acceptedAt: string | null }>, now = new Date(), staleHours = 24): CatalogAlert[] {
  const threshold = now.getTime() - staleHours * 60 * 60 * 1000;
  return states.filter((state) => !state.acceptedAt || !Number.isFinite(Date.parse(state.acceptedAt)) || Date.parse(state.acceptedAt) < threshold)
    .map((state) => ({ id: `stale:${state.world}`, fingerprint: `stale:${state.world}`, world: state.world,
      severity: "critical", kind: "stale", status: "open", runId: null, errorCode: "catalog_stale",
      firstSeenAt: state.acceptedAt || now.toISOString(), lastSeenAt: now.toISOString(), resolvedAt: null }));
}
