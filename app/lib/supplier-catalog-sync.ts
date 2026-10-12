import type { D1Database } from "../../types/cloudflare-runtime";
import {
  acceptSupplierCatalogRun, beginSupplierCatalogRun, finishSupplierCatalogRun,
  readSupplierCatalog, stageSupplierCatalogEntries,
  type SupplierCatalogEntry, type SupplierCatalogWorld,
} from "./supplier-catalog-store.ts";

type CatalogCandidate = { entries: SupplierCatalogEntry[]; fetchedAt: string };

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

export async function runSupplierCatalogSync(db: D1Database, input: {
  id: string;
  world: SupplierCatalogWorld;
  source: string;
  baseline: SupplierCatalogEntry[];
  fetchCandidate: () => Promise<CatalogCandidate>;
  now?: () => Date;
}) {
  const now = input.now || (() => new Date());
  const startedAt = now().toISOString();
  const lockUntil = new Date(Date.parse(startedAt) + 15 * 60_000).toISOString();
  const acquired = await beginSupplierCatalogRun(db, { id: input.id, world: input.world,
    source: input.source, startedAt, lockUntil });
  if (!acquired) return { status: "skipped" as const, world: input.world, id: input.id };
  try {
    const candidate = await input.fetchCandidate();
    if (!Number.isFinite(Date.parse(candidate.fetchedAt)) || Date.parse(candidate.fetchedAt) > now().getTime()) {
      throw new Error("invalid_catalog_timestamp");
    }
    const active = await readSupplierCatalog(db, input.world);
    if (!active && !input.baseline.length) throw new Error("missing_catalog_baseline");
    const previous = active?.entries || input.baseline;
    const diff = compareSupplierCatalogEntries(input.world, previous, candidate.entries);
    const previousChildCount = previous.reduce((count, entry) => count + children(input.world, entry).length, 0);
    if (!catalogRemovalWithinGuard(diff.before, diff.removed.length, previousChildCount, diff.removedChildren.length)) {
      throw new Error("catalog_removal_requires_review");
    }
    for (let index = 0; index < candidate.entries.length; index += 40) {
      await stageSupplierCatalogEntries(db, input.id, input.world, candidate.entries.slice(index, index + 40));
    }
    await acceptSupplierCatalogRun(db, { id: input.id, world: input.world,
      expectedCount: candidate.entries.length, added: diff.added, changed: diff.changed,
      removed: diff.removed.length, finishedAt: now().toISOString() });
    return { status: "accepted" as const, world: input.world, id: input.id, diff, fetchedAt: candidate.fetchedAt };
  } catch (error) {
    const code = errorCode(error);
    const status = code.includes("removal") || code.startsWith("invalid_catalog") ? "rejected" : "failed";
    await finishSupplierCatalogRun(db, { id: input.id, world: input.world,
      status,
      errorCode: code, finishedAt: now().toISOString() });
    return { status, world: input.world, id: input.id, errorCode: code };
  }
}
