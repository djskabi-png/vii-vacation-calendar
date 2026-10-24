import type { D1Database } from "../../types/cloudflare-runtime";
import { sanitizeCatalogDiagnostics, type CatalogSyncDiagnostics } from "./supplier-catalog-diagnostics.ts";
import { approvedSpaCatalogTransition } from "./spa-catalog-approval.ts";

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
// A single accepted vacation generation can contain hundreds of large detail
// documents. D1 caps the bytes returned by one statement, so the guarded sync
// reader must never request the full generation in one result set.
export const CATALOG_SYNC_READ_PAGE_SIZE = 8;

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

function hasImage(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function spaMediaWithinGuard(previous: SupplierCatalogEntry[], candidate: SupplierCatalogEntry[]) {
  const next = new Map(candidate.map((entry) => [entry.supplierId, entry]));
  let beforeSites = 0;
  let lostSites = 0;
  let beforePackages = 0;
  let lostPackages = 0;
  let beforeGalleries = 0;
  let lostGalleries = 0;
  for (const oldEntry of previous) {
    const updated = next.get(oldEntry.supplierId);
    if (!updated) continue;
    const oldSite = oldEntry.summary as Record<string, unknown>;
    const nextSite = updated.summary as Record<string, unknown>;
    if (hasImage(oldSite.image)) {
      beforeSites += 1;
      if (!hasImage(nextSite.image)) lostSites += 1;
    }
    if (Array.isArray(oldSite.gallery) && oldSite.gallery.length > 0) {
      beforeGalleries += 1;
      if (!Array.isArray(nextSite.gallery) || nextSite.gallery.length === 0) lostGalleries += 1;
    }
    const oldPackages = Array.isArray(oldSite.packages) ? oldSite.packages : [];
    const nextPackages = Array.isArray(nextSite.packages) ? nextSite.packages : [];
    const nextById = new Map(nextPackages.map((pack) => [pack.id, pack]));
    for (const oldPack of oldPackages) {
      const nextPack = nextById.get(oldPack.id);
      if (!nextPack || !hasImage(oldPack.image)) continue;
      beforePackages += 1;
      if (!hasImage(nextPack.image)) lostPackages += 1;
    }
  }
  return lostSites <= Math.floor(beforeSites * 0.05)
    && lostPackages <= Math.floor(beforePackages * 0.05)
    && lostGalleries <= Math.floor(beforeGalleries * 0.05);
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
  previous?: SupplierCatalogEntry[];
  candidate?: SupplierCatalogEntry[];
  approvedRemoval?: boolean;
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
  const suppliedPrevious = input.previous?.map((entry): EntryRow => ({
    supplierId: entry.supplierId, summaryJson: JSON.stringify(entry.summary),
    detailJson: entry.detail === undefined ? null : JSON.stringify(entry.detail),
  }));
  const suppliedCandidate = input.candidate?.map((entry): EntryRow => ({
    supplierId: entry.supplierId, summaryJson: JSON.stringify(entry.summary),
    detailJson: entry.detail === undefined ? null : JSON.stringify(entry.detail),
  }));
  if (suppliedPrevious && state.activeRunId && suppliedPrevious.length !== state.activeCount) {
    throw new Error("catalog_candidate_not_accepted");
  }
  if (suppliedCandidate && suppliedCandidate.length !== input.expectedCount) {
    throw new Error("catalog_candidate_not_accepted");
  }
  const oldRows = suppliedPrevious
    ? { results: suppliedPrevious }
    : state.activeRunId
    ? await db.prepare(`SELECT supplier_id AS supplierId, summary_json AS summaryJson, detail_json AS detailJson
      FROM supplier_catalog_entries WHERE run_id = ? AND world = ?`)
      .bind(state.activeRunId, input.world).all<EntryRow>()
    : { results: (input.baseline || []).map((entry): EntryRow => ({
      supplierId: entry.supplierId, summaryJson: JSON.stringify(entry.summary),
      detailJson: entry.detail === undefined ? null : JSON.stringify(entry.detail),
    })) };
  const nextRows = suppliedCandidate
    ? { results: suppliedCandidate }
    : await db.prepare(`SELECT supplier_id AS supplierId, summary_json AS summaryJson,
      detail_json AS detailJson FROM supplier_catalog_entries WHERE run_id = ? AND world = ?`)
      .bind(input.id, input.world).all<EntryRow>();
  if (suppliedCandidate) {
    // A small ID-only read proves the complete staged generation matches the
    // in-memory candidate without returning hundreds of large JSON documents.
    const stagedIds = await db.prepare(`SELECT supplier_id AS supplierId FROM supplier_catalog_entries
      WHERE run_id = ? AND world = ? ORDER BY supplier_id`)
      .bind(input.id, input.world).all<{ supplierId: number }>();
    const expectedIds = suppliedCandidate.map((row) => row.supplierId).sort((a, b) => a - b);
    if (stagedIds.results.length !== expectedIds.length
      || stagedIds.results.some((row, index) => row.supplierId !== expectedIds[index])) {
      throw new Error("catalog_candidate_not_accepted");
    }
  }
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
  const previousEntries = oldRows.results.map((row) => ({ supplierId: row.supplierId,
    summary: JSON.parse(row.summaryJson), detail: row.detailJson ? JSON.parse(row.detailJson) : undefined }));
  const candidateEntries = nextRows.results.map((row) => ({ supplierId: row.supplierId,
    summary: JSON.parse(row.summaryJson), detail: row.detailJson ? JSON.parse(row.detailJson) : undefined }));
  const approvedRemoval = input.approvedRemoval === true && input.world === "spa"
    && approvedSpaCatalogTransition(previousEntries, candidateEntries);
  if (removed !== input.removed
    || (!removalWithinGuard(oldRows.results.length, removed, beforeChildren, removedChildren) && !approvedRemoval)) {
    throw new Error("catalog_removal_requires_review");
  }
  if (input.world === "spa" && !spaMediaWithinGuard(
    previousEntries,
    candidateEntries,
  )) throw new Error("catalog_media_requires_review");
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
  const results: EntryRow[] = [];
  let afterSupplierId = 0;
  while (results.length < state.activeCount) {
    const page = await db.prepare(`SELECT supplier_id AS supplierId, summary_json AS summaryJson,
      detail_json AS detailJson FROM supplier_catalog_entries
      WHERE run_id = ? AND world = ? AND supplier_id > ? ORDER BY supplier_id LIMIT ?`)
      .bind(state.activeRunId, world, afterSupplierId, CATALOG_SYNC_READ_PAGE_SIZE).all<EntryRow>();
    if (!page.results.length) break;
    results.push(...page.results);
    const lastSupplierId = page.results.at(-1)?.supplierId;
    if (!Number.isSafeInteger(lastSupplierId) || Number(lastSupplierId) <= afterSupplierId) {
      throw new Error("catalog_active_generation_incomplete");
    }
    afterSupplierId = Number(lastSupplierId);
  }
  if (results.length !== state.activeCount) throw new Error("catalog_active_generation_incomplete");
  return {
    acceptedAt: state.acceptedAt,
    entries: results.map((row) => ({ supplierId: row.supplierId, summary: JSON.parse(row.summaryJson),
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

/** Distinguish no accepted generation from an absent entry in one snapshot. */
export async function readSupplierCatalogDetailSnapshot(db: D1Database,
  world: Extract<SupplierCatalogWorld, "vacations" | "events">, supplierId: number) {
  if (!validWorld(world) || !Number.isSafeInteger(supplierId) || supplierId < 1) return null;
  const row = await db.prepare(`SELECT s.active_run_id AS activeRunId, e.detail_json AS detailJson
    FROM supplier_catalog_state s LEFT JOIN supplier_catalog_entries e
      ON e.run_id = s.active_run_id AND e.world = s.world AND e.supplier_id = ?
    WHERE s.world = ?`).bind(supplierId, world)
    .first<{ activeRunId: string | null; detailJson: string | null }>();
  if (!row) return null;
  return { activeRunId: row.activeRunId, detail: row.detailJson ? JSON.parse(row.detailJson) : null };
}

export async function readSupplierCatalogDetails(db: D1Database, world: Extract<SupplierCatalogWorld, "vacations" | "events">, supplierIds: readonly number[]) {
  const ids = [...new Set(supplierIds)].filter((supplierId) => Number.isSafeInteger(supplierId) && supplierId > 0);
  if (!ids.length) return new Map<number, unknown>();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await db.prepare(`SELECT e.supplier_id AS supplierId, e.detail_json AS detailJson
    FROM supplier_catalog_state s
    JOIN supplier_catalog_entries e ON e.run_id = s.active_run_id AND e.world = s.world
    WHERE s.world = ? AND e.supplier_id IN (${placeholders})`)
    .bind(world, ...ids).all<{ supplierId: number; detailJson: string | null }>();
  return new Map(rows.results.map((row) => [row.supplierId, row.detailJson ? JSON.parse(row.detailJson) : null]));
}

export async function readSupplierCatalogState(db: D1Database, world: SupplierCatalogWorld) {
  if (!validWorld(world)) return null;
  return db.prepare(`SELECT active_run_id AS activeRunId, active_count AS activeCount,
    accepted_at AS acceptedAt FROM supplier_catalog_state WHERE world = ?`)
    .bind(world).first<StateRow>();
}

/** Bounded library-card projection; never reads detail_json or another generation. */
export async function readSupplierCatalogSelectedSummaries(db: D1Database, world: SupplierCatalogWorld, supplierIds: readonly number[]) {
  const ids = [...new Set(supplierIds)].filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 8);
  if (!validWorld(world) || !ids.length) return [];
  const rows = await db.prepare(`SELECT s.active_run_id AS activeRunId, e.summary_json AS summaryJson
    FROM supplier_catalog_state s LEFT JOIN supplier_catalog_entries e
      ON e.run_id = s.active_run_id AND e.world = s.world AND e.supplier_id IN (${ids.map(() => "?").join(",")})
    WHERE s.world = ?`).bind(...ids, world).all<{ activeRunId: string | null; summaryJson: string | null }>();
  if (!rows.results[0]?.activeRunId) return null;
  return rows.results.flatMap(row => row.summaryJson ? [JSON.parse(row.summaryJson)] : []);
}

export async function readSupplierCatalogDashboard(db: D1Database) {
  const [states, runs] = await Promise.all([
    db.prepare(`SELECT world, active_run_id AS activeRunId, active_count AS activeCount,
      accepted_at AS acceptedAt, lock_run_id AS lockRunId, lock_until AS lockUntil
      FROM supplier_catalog_state ORDER BY world`).all<{ world: SupplierCatalogWorld; activeRunId: string | null;
        activeCount: number; acceptedAt: string | null; lockRunId: string | null; lockUntil: string | null }>(),
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

export async function readSupplierCatalogSummaries(db: D1Database, world: SupplierCatalogWorld,
  selectedState?: Awaited<ReturnType<typeof readSupplierCatalogState>>) {
  if (!validWorld(world)) return null;
  const state = selectedState === undefined ? await db.prepare(`SELECT active_run_id AS activeRunId, active_count AS activeCount,
    accepted_at AS acceptedAt FROM supplier_catalog_state WHERE world = ?`)
    .bind(world).first<StateRow>() : selectedState;
  if (!state?.activeRunId) return null;
  const rows = await db.prepare(`SELECT supplier_id AS supplierId, summary_json AS summaryJson
    FROM supplier_catalog_entries WHERE run_id = ? AND world = ? ORDER BY supplier_id`)
    .bind(state.activeRunId, world).all<{ supplierId: number; summaryJson: string }>();
  if (rows.results.length !== state.activeCount) throw new Error("catalog_active_generation_incomplete");
  return { acceptedAt: state.acceptedAt,
    entries: rows.results.map((row) => ({ supplierId: row.supplierId, summary: JSON.parse(row.summaryJson) })) };
}

export async function readSupplierCatalogReviewDetails(db: D1Database,
  world: Extract<SupplierCatalogWorld, "vacations" | "events">, supplierIds: readonly number[]) {
  const ids = [...new Set(supplierIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!ids.length) return new Map<number, unknown>();
  const rows = await db.prepare(`SELECT e.supplier_id AS supplierId,
    json_extract(e.detail_json, '$.reviews') AS reviewsJson
    FROM supplier_catalog_state s
    JOIN supplier_catalog_entries e ON e.run_id = s.active_run_id AND e.world = s.world
    WHERE s.world = ? AND e.supplier_id IN (${ids.map(() => "?").join(", ")})`)
    .bind(world, ...ids).all<{ supplierId: number; reviewsJson: string | null }>();
  return new Map(rows.results.map((row) => [row.supplierId,
    { reviews: row.reviewsJson ? JSON.parse(row.reviewsJson) : undefined }]));
}

type PublicReview = { text: string; author?: string; date?: string };

function usableReview(value: unknown): value is PublicReview {
  return Boolean(value && typeof value === "object" &&
    typeof (value as PublicReview).text === "string" && (value as PublicReview).text.trim().length >= 30);
}

/** Only the first usable review is needed by the homepage, not every review. */
export async function readSupplierCatalogReviewPreviews(db: D1Database,
  world: Extract<SupplierCatalogWorld, "vacations" | "events">, supplierIds: readonly number[]) {
  const ids = [...new Set(supplierIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!ids.length) return null;
  const rows = await db.prepare(`SELECT s.active_run_id AS activeRunId, e.supplier_id AS supplierId,
    (SELECT r.value FROM json_each(CASE WHEN json_type(e.detail_json, '$.reviews') = 'array'
      THEN json_extract(e.detail_json, '$.reviews') ELSE '[]' END) r
      WHERE r.type = 'object' AND
        CASE WHEN r.type = 'object' THEN json_type(r.value, '$.text') = 'text' AND
          length(CAST(json_extract(r.value, '$.text') AS BLOB)) >= 30 ELSE 0 END
      ORDER BY CAST(r.key AS INTEGER) LIMIT 1) AS reviewJson
    FROM supplier_catalog_state s LEFT JOIN supplier_catalog_entries e
      ON e.run_id = s.active_run_id AND e.world = s.world
      AND e.supplier_id IN (${ids.map(() => "?").join(", ")})
    WHERE s.world = ?`).bind(...ids, world)
    .all<{ activeRunId: string | null; supplierId: number | null; reviewJson: string | null }>();
  const activeRunId = rows.results[0]?.activeRunId;
  if (!activeRunId) return null;
  const previews = new Map<number, { reviews: PublicReview[] }>();
  const fallbackIds: number[] = [];
  for (const row of rows.results) {
    if (row.supplierId === null) continue;
    const review: unknown = row.reviewJson ? JSON.parse(row.reviewJson) : null;
    if (review !== null && !usableReview(review)) fallbackIds.push(row.supplierId);
    previews.set(row.supplierId, { reviews: usableReview(review) ? [review] : [] });
  }
  // UTF-8 byte length is a conservative superset of JS UTF-16/trim length.
  // A byte-eligible but unusable candidate (spaces, emoji, etc.) must not hide
  // a later valid review. Rare fallbacks read the same pinned generation.
  if (fallbackIds.length) {
    const fallback = await db.prepare(`SELECT supplier_id AS supplierId,
      json_extract(detail_json, '$.reviews') AS reviewsJson FROM supplier_catalog_entries
      WHERE run_id = ? AND world = ? AND supplier_id IN (${fallbackIds.map(() => "?").join(", ")})`)
      .bind(activeRunId, world, ...fallbackIds).all<{ supplierId: number; reviewsJson: string | null }>();
    for (const row of fallback.results) {
      const reviews: unknown = row.reviewsJson ? JSON.parse(row.reviewsJson) : [];
      const review = Array.isArray(reviews) ? reviews.find(usableReview) : undefined;
      previews.set(row.supplierId, { reviews: review ? [review] : [] });
    }
  }
  return { activeRunId, previews };
}
