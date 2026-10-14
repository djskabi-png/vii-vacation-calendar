import type { D1Database } from "../../types/cloudflare-runtime";
import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { readSupplierCatalogState } from "./supplier-catalog-store.ts";
import { catalogPullSlot } from "./supplier-catalog-schedule.ts";
import { CATALOG_RETRY_DELAY_MS, cancelPendingCatalogRetries, scheduleCatalogRetry } from "./supplier-catalog-retry.ts";

type Run = { id: string; world: SupplierCatalogWorld; source: string; status: string;
  candidateCount: number | null; errorCode: string | null };

async function readRun(db: D1Database, id: string, world: SupplierCatalogWorld) {
  return db.prepare(`SELECT id, world, source, status, candidate_count AS candidateCount,
    error_code AS errorCode FROM supplier_catalog_runs WHERE id = ? AND world = ?`)
    .bind(id, world).first<Run>();
}

export async function pullCatalogSlot(db: D1Database, world: SupplierCatalogWorld, dependencies: {
  sync: (id: string, world: SupplierCatalogWorld) => Promise<unknown>;
  now?: () => Date;
}) {
  if (!["vacations", "events", "rooms", "spa"].includes(world)) throw new Error("invalid_world");
  const slot = catalogPullSlot((dependencies.now || (() => new Date()))(), world);
  if (!slot) return { world, status: "no_due_slot", source: "scheduled" };
  const previous = await readRun(db, slot.id, world);
  // The guarded runner's INSERT OR IGNORE supplies the atomic concurrency boundary.
  if (!previous) {
    const now = (dependencies.now || (() => new Date()))();
    await scheduleCatalogRetry(db, { rootRunId: slot.id, world, attempt: 1,
      dueAt: new Date(now.getTime() + CATALOG_RETRY_DELAY_MS).toISOString(), createdAt: now.toISOString() });
    await dependencies.sync(slot.id, world);
  }
  const run = await readRun(db, slot.id, world);
  if (!run || run.source !== "scheduled") throw new Error("catalog_result_unavailable");
  const state = await readSupplierCatalogState(db, world);
  const status = ["requested", "running", "accepted", "rejected", "failed", "skipped"].includes(run.status)
    ? run.status : "unknown";
  const errorCode = run.errorCode === "catalog_removal_requires_review" || run.errorCode === "catalog_media_requires_review"
    ? run.errorCode : run.errorCode ? "catalog_pull_failed" : null;
  if (run.status === "accepted" || run.status === "rejected") await cancelPendingCatalogRetries(db, slot.id,
    (dependencies.now || (() => new Date()))().toISOString(), run.status, run.id, run.errorCode || undefined);
  return { ...slot, source: "scheduled", status, repeated: !!previous, persisted: true,
    candidateCount: run.candidateCount, activeCount: state?.activeCount || 0,
    activeGenerationMatchesRun: state?.activeRunId === slot.id, errorCode,
    callerAuthenticated: true, callerAuthorized: true, identitySource: "sites-request-identity" };
}
