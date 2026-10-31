import type { D1Database } from "../../types/cloudflare-runtime";
import { catalogInventoryDiagnostics, SupplierCatalogRedirectError, SpaCatalogJsonError, SpaEditorialReviewError, type CatalogSyncDiagnostics } from "./supplier-catalog-diagnostics.ts";
import {
  acceptSupplierCatalogRun, beginSupplierCatalogRun, finishSupplierCatalogRun,
  readSupplierCatalog, stageSupplierCatalogEntries,
  spaMediaWithinGuard,
  type SupplierCatalogEntry, type SupplierCatalogWorld,
} from "./supplier-catalog-store.ts";
import { approvedSpaCatalogTransition } from "./spa-catalog-approval.ts";

type CatalogCandidate = { entries: SupplierCatalogEntry[]; fetchedAt: string };

type CatalogContentIssue = {
  supplierId: number;
  path: string;
  reason: "collection_missing" | "item_removed";
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function records(value: unknown) {
  return Array.isArray(value) ? value.map(object) : [];
}

function removedStrings(before: unknown, after: unknown) {
  const next = new Set(strings(after));
  return strings(before).filter((item) => !next.has(item));
}

function collectionIssues(supplierId: number, path: string, before: unknown, after: unknown): CatalogContentIssue[] {
  const oldItems = Array.isArray(before) ? before : [];
  if (!oldItems.length) return [];
  if (!Array.isArray(after) || !after.length) return [{ supplierId, path, reason: "collection_missing" }];
  return [];
}

/**
 * Supplier responses currently have no field-level tombstones. A partial
 * response must therefore never erase already accepted public content.
 */
export function catalogContentIntegrityIssues(world: SupplierCatalogWorld,
  previous: SupplierCatalogEntry[], candidate: SupplierCatalogEntry[]): CatalogContentIssue[] {
  if (world !== "vacations" && world !== "events") return [];
  const next = new Map(candidate.map((entry) => [entry.supplierId, entry]));
  const issues: CatalogContentIssue[] = [];
  for (const oldEntry of previous) {
    const updated = next.get(oldEntry.supplierId);
    if (!updated) continue;
    const before = object(oldEntry.detail);
    const after = object(updated.detail);
    for (const key of ["images", "galleryGroups", "features", "featureGroups", "rooms"] as const) {
      issues.push(...collectionIssues(oldEntry.supplierId, `detail.${key}`, before[key], after[key]));
    }
    if (removedStrings(before.images, after.images).length) {
      issues.push({ supplierId: oldEntry.supplierId, path: "detail.images", reason: "item_removed" });
    }
    const afterGalleryGroups = new Map(records(after.galleryGroups).map((group) => [String(group.title || ""), group]));
    for (const group of records(before.galleryGroups)) {
      const title = String(group.title || "");
      const nextGroup = afterGalleryGroups.get(title);
      if (!nextGroup) {
        issues.push({ supplierId: oldEntry.supplierId, path: `detail.galleryGroups.${title || "untitled"}`, reason: "item_removed" });
      } else if (removedStrings(group.images, nextGroup.images).length) {
        issues.push({ supplierId: oldEntry.supplierId, path: `detail.galleryGroups.${title || "untitled"}.images`, reason: "item_removed" });
      }
    }
    const afterRooms = new Map(records(after.rooms).map((room) => [Number(room.id), room]));
    for (const room of records(before.rooms)) {
      const roomId = Number(room.id);
      const nextRoom = afterRooms.get(roomId);
      if (!Number.isSafeInteger(roomId) || roomId < 1 || !nextRoom) continue;
      for (const key of ["images", "features", "featureGroups"] as const) {
        issues.push(...collectionIssues(oldEntry.supplierId, `detail.rooms.${roomId}.${key}`, room[key], nextRoom[key]));
      }
      if (removedStrings(room.images, nextRoom.images).length || removedStrings(room.features, nextRoom.features).length) {
        issues.push({ supplierId: oldEntry.supplierId, path: `detail.rooms.${roomId}`, reason: "item_removed" });
      }
    }
  }
  return issues.slice(0, 100);
}

function children(world: SupplierCatalogWorld, entry: SupplierCatalogEntry) {
  const summary = entry.summary as Record<string, unknown>;
  const detail = entry.detail as Record<string, unknown> | undefined;
  const list = world === "spa" ? summary?.packages : world === "rooms" ? summary?.rooms : detail?.rooms;
  if (!Array.isArray(list)) return [];
  return list.map((item) => Number(item?.id)).filter((id) => Number.isSafeInteger(id) && id > 0);
}

export function compareSupplierCatalogEntries(world: SupplierCatalogWorld,
  previous: SupplierCatalogEntry[], candidate: SupplierCatalogEntry[]) {
  if (!candidate.length || candidate.length > 10_000) throw new Error("invalid_catalog_candidate");
  const before = new Map(previous.map((entry) => [entry.supplierId, entry]));
  const next = new Map<number, SupplierCatalogEntry>();
  let added = 0;
  let changed = 0;
  for (const entry of candidate) {
    if (!Number.isSafeInteger(entry.supplierId) || entry.supplierId < 1 || next.has(entry.supplierId)
      || !entry.summary || typeof entry.summary !== "object") throw new Error("invalid_catalog_candidate");
    next.set(entry.supplierId, entry);
    const old = before.get(entry.supplierId);
    if (!old) added += 1;
    else if (JSON.stringify(old.summary) !== JSON.stringify(entry.summary)
      || JSON.stringify(old.detail) !== JSON.stringify(entry.detail)) changed += 1;
  }
  const removed = [...before.keys()].filter((id) => !next.has(id));
  const removedChildren = previous.flatMap((old) => {
    const updated = next.get(old.supplierId);
    if (!updated) return [];
    const nextIds = new Set(children(world, updated));
    return children(world, old).filter((id) => !nextIds.has(id)).map((id) => ({ supplierId: old.supplierId, childId: id }));
  });
  return { before: previous.length, after: candidate.length, added, changed, removed, removedChildren };
}

export function catalogRemovalWithinGuard(before: number, removed: number, beforeChildren: number, removedChildren: number) {
  return removed <= Math.floor(before * 0.05)
    && removedChildren <= Math.floor(beforeChildren * 0.05);
}

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown_error";
  return /^[a-z_]{3,100}$/.test(message) ? message : "supplier_sync_failed";
}

function failureCategory(code: string, stage: NonNullable<CatalogSyncDiagnostics["failure"]>["stage"]): NonNullable<CatalogSyncDiagnostics["failure"]>["category"] {
  if (code.includes("not_authorized") || code.includes("missing_sergey_key")) return "authorization";
  if (code.includes("transport") || code.includes("timeout")) return "transport";
  if (code.includes("provider")) return "provider";
  if (code.includes("invalid_sergey") || code.includes("invalid_spa_response")) return "invalid_response";
  if (code.startsWith("invalid_catalog") || code.includes("missing_catalog") || code === "catalog_content_requires_review") return "invalid_data";
  if (stage === "catalog_read" || stage === "candidate_stage" || stage === "publish") return "database";
  if (stage === "source_fetch" && code === "supplier_sync_failed") return "resource_or_runtime";
  return "unknown";
}

export async function runSupplierCatalogSync(db: D1Database, input: {
  id: string;
  world: SupplierCatalogWorld;
  source: string;
  baseline: SupplierCatalogEntry[];
  fetchCandidate: (previous: SupplierCatalogEntry[]) => Promise<CatalogCandidate>;
  validateCandidate?: (entries: SupplierCatalogEntry[]) => Promise<void>;
  now?: () => Date;
}) {
  const now = input.now || (() => new Date());
  const startedAt = now().toISOString();
  const startedMs = Date.parse(startedAt);
  const lockUntil = new Date(Date.parse(startedAt) + 15 * 60_000).toISOString();
  const acquired = await beginSupplierCatalogRun(db, { id: input.id, world: input.world,
    source: input.source, startedAt, lockUntil });
  if (!acquired) return { status: "skipped" as const, world: input.world, id: input.id };
  let diagnostics: CatalogSyncDiagnostics | undefined;
  let stage: NonNullable<CatalogSyncDiagnostics["failure"]>["stage"] = "source_fetch";
  let completed = 0;
  let total: number | undefined;
  try {
    stage = "catalog_read";
    const active = await readSupplierCatalog(db, input.world);
    if (!active && !input.baseline.length) throw new Error("missing_catalog_baseline");
    const previous = active?.entries || input.baseline;
    stage = "source_fetch";
    const candidate = await input.fetchCandidate(previous);
    stage = "candidate_validation";
    total = candidate.entries.length;
    if (!Number.isFinite(Date.parse(candidate.fetchedAt)) || Date.parse(candidate.fetchedAt) > now().getTime()) {
      throw new Error("invalid_catalog_timestamp");
    }
    stage = "candidate_compare";
    const diff = compareSupplierCatalogEntries(input.world, previous, candidate.entries);
    diagnostics = catalogInventoryDiagnostics(input.world, previous, candidate.entries, diff.changed);
    if (catalogContentIntegrityIssues(input.world, previous, candidate.entries).length) {
      throw new Error("catalog_content_requires_review");
    }
    const previousChildCount = previous.reduce((count, entry) => count + children(input.world, entry).length, 0);
    if (!catalogRemovalWithinGuard(diff.before, diff.removed.length, previousChildCount, diff.removedChildren.length)
      && !(input.world === "spa" && approvedSpaCatalogTransition(previous, candidate.entries))) {
      throw new Error("catalog_removal_requires_review");
    }
    if (input.world === "spa" && !spaMediaWithinGuard(previous, candidate.entries)) {
      throw new Error("catalog_media_requires_review");
    }
    await input.validateCandidate?.(candidate.entries);
    stage = "candidate_stage";
    for (let index = 0; index < candidate.entries.length; index += 40) {
      await stageSupplierCatalogEntries(db, input.id, input.world, candidate.entries.slice(index, index + 40));
      completed = Math.min(candidate.entries.length, index + 40);
    }
    stage = "publish";
    await acceptSupplierCatalogRun(db, { id: input.id, world: input.world,
      expectedCount: candidate.entries.length, added: diff.added, changed: diff.changed,
      removed: diff.removed.length, finishedAt: now().toISOString(), baseline: input.baseline,
      previous, candidate: candidate.entries,
      approvedRemoval: input.world === "spa" && approvedSpaCatalogTransition(previous, candidate.entries) });
    return { status: "accepted" as const, world: input.world, id: input.id, diff, fetchedAt: candidate.fetchedAt };
  } catch (error) {
    if (error instanceof SpaEditorialReviewError) diagnostics = { ...diagnostics, ...error.diagnostics };
    if (error instanceof SupplierCatalogRedirectError || error instanceof SpaCatalogJsonError) diagnostics = error.diagnostics;
    const code = errorCode(error);
    diagnostics = { ...diagnostics, failure: {
      stage, category: failureCategory(code, stage),
      elapsedMs: Math.max(0, now().getTime() - startedMs),
      ...(stage === "candidate_stage" ? { completed, ...(total !== undefined ? { total } : {}) } : {}),
      retryable: ["transport", "provider", "resource_or_runtime", "database", "unknown"].includes(failureCategory(code, stage)),
    } };
    const status = code.includes("removal") || code === "catalog_media_requires_review" || code === "catalog_editorial_requires_review"
      || code === "catalog_content_requires_review"
      || code.startsWith("invalid_catalog") ? "rejected" : "failed";
    await finishSupplierCatalogRun(db, { id: input.id, world: input.world,
      status,
      errorCode: code, finishedAt: now().toISOString(), diagnostics });
    return { status, world: input.world, id: input.id, errorCode: code, ...(diagnostics ? { diagnostics } : {}) };
  }
}
