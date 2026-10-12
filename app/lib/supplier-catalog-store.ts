import type { D1Database } from "../../types/cloudflare-runtime";
import { sanitizeCatalogDiagnostics, type CatalogSyncDiagnostics } from "./supplier-catalog-diagnostics.ts";

export type SupplierCatalogWorld = "vacations" | "events" | "rooms" | "spa";

export type SupplierCatalogEntry = {
  supplierId: number;
  summary: unknown;
  detail?: unknown;
};

type RunRow = { status: string };
type CountRow = { count: number };
type StateRow = { activeRunId: string | null; activeCount: number; acceptedAt: string | null };
type EntryRow = { supplierId: number; summaryJson: string; detailJson: string | null };

const rowLimitBytes = 1_800_000;

function validWorld(world: string): world is SupplierCatalogWorld {
  return ["vacations", "events", "rooms", "spa"].includes(world);
}

function childIds(world: SupplierCatalogWorld, row: EntryRow) {
  const summary = JSON.parse(row.summaryJson) as Record<string, unknown>;
  const detail = row.detailJson ? JSON.parse(row.detailJson) as Record<string, unknown> : null;
  const children = world === "spa" ? summary.packages
    : world === "rooms" ? summary.rooms : detail?.rooms;
  if (children === undefined || children === null) return [];
  if (!Array.isArray(children)) throw new Error("invalid_catalog_child_inventory");
  const ids = children.map((child) => Number(child?.id)).filter((id) => Number.isSafeInteger(id) && id > 0);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate_catalog_child_inventory");
  return ids;
}

function removalWithinGuard(before: number, removed: number, beforeChildren: number, removedChildren: number) {
  return removed <= Math.floor(before * 0.05)
    && removedChildren <= Math.floor(beforeChildren * 0.05);
}

export async function beginSupplierCatalogRun(db: D1Database, input: {
  id: string;
  world: SupplierCatalogWorld;
  source: string;
  startedAt: string;
  lockUntil: string;
}) {
  if (!validWorld(input.world) || !/^[a-zA-Z0-9_-]{8,100}$/.test(input.id)
    || !Number.isFinite(Date.parse(input.startedAt)) || !Number.isFinite(Date.parse(input.lockUntil))
    || Date.parse(input.lockUntil) <= Date.parse(input.startedAt)) {
    throw new Error("invalid_catalog_run");
  }
  const inserted = await db.prepare(`INSERT OR IGNORE INTO supplier_catalog_runs
    (id, world, source, status, started_at) VALUES (?, ?, ?, 'requested', ?)`)
    .bind(input.id, input.world, input.source, input.startedAt).run();
  if (inserted.meta.changes !== 1) return false;
  await db.prepare("INSERT OR IGNORE INTO supplier_catalog_state (world, active_count) VALUES (?, 0)")
    .bind(input.world).run();
  const acquired = await db.prepare(`UPDATE supplier_catalog_state SET lock_run_id = ?, lock_until = ?
    WHERE world = ? AND (lock_run_id IS NULL OR lock_until <= ?)`)
    .bind(input.id, input.lockUntil, input.world, input.startedAt).run();
  if (acquired.meta.changes !== 1) {
    await db.prepare("UPDATE supplier_catalog_runs SET status = 'skipped', finished_at = ? WHERE id = ?")
      .bind(input.startedAt, input.id).run();
    return false;
  }
  await db.prepare("UPDATE supplier_catalog_runs SET status = 'running' WHERE id = ?")
    .bind(input.id).run();
  return true;
}

export async function stageSupplierCatalogEntries(db: D1Database, runId: string, world: SupplierCatalogWorld, entries: SupplierCatalogEntry[]) {
  const run = await db.prepare("SELECT status FROM supplier_catalog_runs WHERE id = ? AND world = ?")
    .bind(runId, world).first<RunRow>();
  if (run?.status !== "running" || !entries.length || entries.length > 40) throw new Error("invalid_catalog_stage");
  const ids = new Set<number>();
  const statements = entries.map((entry) => {
    if (!Number.isSafeInteger(entry.supplierId) || entry.supplierId <= 0 || ids.has(entry.supplierId)) {
      throw new Error("invalid_supplier_id");
    }
    ids.add(entry.supplierId);
    const summaryJson = JSON.stringify(entry.summary);
    const detailJson = entry.detail === undefined ? null : JSON.stringify(entry.detail);
    const byteLength = new TextEncoder().encode(summaryJson || "").length
      + new TextEncoder().encode(detailJson || "").length;
    if (!summaryJson || byteLength > rowLimitBytes) {
      throw new Error("catalog_entry_too_large");
    }
    return db.prepare(`INSERT INTO supplier_catalog_entries
      (id, run_id, world, supplier_id, summary_json, detail_json) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(`${runId}:${world}:${entry.supplierId}`, runId, world, entry.supplierId, summaryJson, detailJson);
  });
  await db.batch(statements);
}

export async function acceptSupplierCatalogRun(db: D1Database, input: {
  id: string;
  world: SupplierCatalogWorld;
  expectedCount: number;
  added: number;
  changed: number;
  removed: number;
  finishedAt: string;
  baseline?: SupplierCatalogEntry[];
}) {
  const state = await db.prepare(`SELECT active_run_id AS activeRunId, active_count AS activeCount,
    accepted_at AS acceptedAt FROM supplier_catalog_state WHERE world = ? AND lock_run_id = ?`)
    .bind(input.world, input.id).first<StateRow>();
  const run = await db.prepare("SELECT status FROM supplier_catalog_runs WHERE id = ? AND world = ?")
    .bind(input.id, input.world).first<RunRow>();
  const staged = await db.prepare("SELECT COUNT(*) AS count FROM supplier_catalog_entries WHERE run_id = ? AND world = ?")
    .bind(input.id, input.world).first<CountRow>();
  if (!state || run?.status !== "running" || !Number.isSafeInteger(input.expectedCount)
    || input.expectedCount < 1 || staged?.count !== input.expectedCount || input.removed < 0) {
    throw new Error("catalog_candidate_not_accepted");
  }
  const oldRows = state.activeRunId
    ? await db.prepare(`SELECT supplier_id AS supplierId, summary_json AS summaryJson, detail_json AS detailJson
      FROM supplier_catalog_entries WHERE run_id = ? AND world = ?`)
      .bind(state.activeRunId, input.world).all<EntryRow>()
    : { results: (input.baseline || []).map((entry): EntryRow => ({
      supplierId: entry.supplierId, summaryJson: JSON.stringify(entry.summary),
      detailJson: entry.detail === undefined ? null : JSON.stringify(entry.detail),
    })) };
  const nextRows = await db.prepare(`SELECT supplier_id AS supplierId, summary_json AS summaryJson,
    detail_json AS detailJson FROM supplier_catalog_entries WHERE run_id = ? AND world = ?`)
    .bind(input.id, input.world).all<EntryRow>();
  const next = new Map(nextRows.results.map((row) => [row.supplierId, row]));
  for (const row of nextRows.results) childIds(input.world, row);
  let removed = 0;
  let beforeChildren = 0;
  let removedChildren = 0;
  for (const old of oldRows.results) {
    const candidate = next.get(old.supplierId);
    const oldChildren = childIds(input.world, old);
    beforeChildren += oldChildren.length;
    if (!candidate) { removed += 1; continue; }
    const candidateChildren = new Set(childIds(input.world, candidate));
    removedChildren += oldChildren.filter((id) => !candidateChildren.has(id)).length;
  }
  if (removed !== input.removed || !removalWithinGuard(oldRows.results.length, removed, beforeChildren, removedChildren)) {
    throw new Error("catalog_removal_requires_review");
  }
  const results = await db.batch([
    db.prepare(`UPDATE supplier_catalog_state SET active_run_id = ?, accepted_at = ?, active_count = ?,
      lock_run_id = NULL, lock_until = NULL WHERE world = ? AND lock_run_id = ?`)
      .bind(input.id, input.finishedAt, input.expectedCount, input.world, input.id),
    db.prepare(`UPDATE supplier_catalog_runs SET status = 'accepted', finished_at = ?,
      before_count = ?, candidate_count = ?, added_count = ?, changed_count = ?, removed_count = ?
      WHERE id = ? AND world = ? AND status = 'running'
      AND EXISTS (SELECT 1 FROM supplier_catalog_state WHERE world = ? AND active_run_id = ?)`)
      .bind(input.finishedAt, oldRows.results.length, input.expectedCount, input.added, input.changed, removed, input.id, input.world, input.world, input.id),
  ]);
  if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) throw new Error("catalog_publish_race");
}

export async function finishSupplierCatalogRun(db: D1Database, input: {
  id: string;
  world: SupplierCatalogWorld;
  status: "failed" | "rejected";
  errorCode: string;
  finishedAt: string;
  diagnostics?: CatalogSyncDiagnostics;
}) {
  const diagnostics = sanitizeCatalogDiagnostics(input.diagnostics);
  await db.batch([
    db.prepare(`UPDATE supplier_catalog_runs SET status = ?, error_code = ?, finished_at = ?,
      before_count = ?, candidate_count = ?, added_count = ?, changed_count = ?, removed_count = ?, diagnostics_json = ?
      WHERE id = ? AND world = ? AND status IN ('requested', 'running')`)
      .bind(input.status, input.errorCode.slice(0, 100), input.finishedAt,
        diagnostics?.before ?? null, diagnostics?.candidate ?? null, diagnostics?.addedCount ?? null,
        diagnostics?.changedCount ?? null, diagnostics?.removedCount ?? null,
        diagnostics ? JSON.stringify(diagnostics) : null, input.id, input.world),
    db.prepare(`UPDATE supplier_catalog_state SET lock_run_id = NULL, lock_until = NULL
      WHERE world = ? AND lock_run_id = ?`).bind(input.world, input.id),
  ]);
}

export async function readSupplierCatalog(db: D1Database, world: SupplierCatalogWorld) {
  const state = await db.prepare(`SELECT active_run_id AS activeRunId, active_count AS activeCount,
    accepted_at AS acceptedAt FROM supplier_catalog_state WHERE world = ?`)
    .bind(world).first<StateRow>();
  if (!state?.activeRunId) return null;
  const rows = await db.prepare(`SELECT supplier_id AS supplierId, summary_json AS summaryJson,
    detail_json AS detailJson FROM supplier_catalog_entries WHERE run_id = ? AND world = ? ORDER BY supplier_id`)
    .bind(state.activeRunId, world).all<EntryRow>();
  if (rows.results.length !== state.activeCount) throw new Error("catalog_active_generation_incomplete");
  return {
    acceptedAt: state.acceptedAt,
    entries: rows.results.map((row) => ({ supplierId: row.supplierId, summary: JSON.parse(row.summaryJson),
      detail: row.detailJson ? JSON.parse(row.detailJson) : null })),
  };
}

export async function readSupplierCatalogEntry(db: D1Database, world: SupplierCatalogWorld, supplierId: number) {
  if (!validWorld(world) || !Number.isSafeInteger(supplierId) || supplierId < 1) return null;
  const row = await db.prepare(`SELECT e.summary_json AS summaryJson, e.detail_json AS detailJson,
    s.accepted_at AS acceptedAt FROM supplier_catalog_state s
    JOIN supplier_catalog_entries e ON e.run_id = s.active_run_id AND e.world = s.world
    WHERE s.world = ? AND e.supplier_id = ?`)
    .bind(world, supplierId).first<{ summaryJson: string; detailJson: string | null; acceptedAt: string | null }>();
  if (!row) return null;
  return { supplierId, acceptedAt: row.acceptedAt, summary: JSON.parse(row.summaryJson),
    detail: row.detailJson ? JSON.parse(row.detailJson) : null };
}

export async function readSupplierCatalogState(db: D1Database, world: SupplierCatalogWorld) {
  if (!validWorld(world)) return null;
  return db.prepare(`SELECT active_run_id AS activeRunId, active_count AS activeCount,
    accepted_at AS acceptedAt FROM supplier_catalog_state WHERE world = ?`)
    .bind(world).first<StateRow>();
}

export async function readSupplierCatalogDashboard(db: D1Database) {
  const [states, runs] = await Promise.all([
    db.prepare(`SELECT world, active_run_id AS activeRunId, active_count AS activeCount,
      accepted_at AS acceptedAt, lock_run_id AS lockRunId, lock_until AS lockUntil
      FROM supplier_catalog_state ORDER BY world`).all(),
    db.prepare(`SELECT id, world, source, status, started_at AS startedAt,
      finished_at AS finishedAt, before_count AS beforeCount, candidate_count AS candidateCount,
      added_count AS addedCount, changed_count AS changedCount, removed_count AS removedCount,
      error_code AS errorCode, diagnostics_json AS diagnosticsJson
      FROM supplier_catalog_runs ORDER BY started_at DESC LIMIT 40`).all<Record<string, unknown>>(),
  ]);
  return { states: states.results, runs: runs.results.map(({ diagnosticsJson, ...run }) => {
    let diagnostics: CatalogSyncDiagnostics | undefined;
    try { diagnostics = sanitizeCatalogDiagnostics(JSON.parse(String(diagnosticsJson))); } catch { /* Old runs have no diagnostics. */ }
    return { ...run, ...(diagnostics ? { diagnostics } : {}) };
  }) };
}

export async function readSupplierCatalogSummaries(db: D1Database, world: SupplierCatalogWorld) {
  if (!validWorld(world)) return null;
  const state = await db.prepare(`SELECT active_run_id AS activeRunId, active_count AS activeCount,
    accepted_at AS acceptedAt FROM supplier_catalog_state WHERE world = ?`)
    .bind(world).first<StateRow>();
  if (!state?.activeRunId) return null;
  const rows = await db.prepare(`SELECT supplier_id AS supplierId, summary_json AS summaryJson
    FROM supplier_catalog_entries WHERE run_id = ? AND world = ? ORDER BY supplier_id`)
    .bind(state.activeRunId, world).all<{ supplierId: number; summaryJson: string }>();
  if (rows.results.length !== state.activeCount) throw new Error("catalog_active_generation_incomplete");
  return { acceptedAt: state.acceptedAt,
    entries: rows.results.map((row) => ({ supplierId: row.supplierId, summary: JSON.parse(row.summaryJson) })) };
}
