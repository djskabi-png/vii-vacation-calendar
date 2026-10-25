import type { D1Database } from "../../types/cloudflare-runtime";
import { catalogPullSlot, scheduledCatalogRunId, scheduledCatalogWorld } from "./supplier-catalog-schedule.ts";
import { catalogWorlds, syncSupplierCatalogWorld } from "./supplier-catalog-runtime.ts";
import { CATALOG_MAX_RETRIES, CATALOG_RETRY_DELAY_MS, cancelPendingCatalogRetries,
  claimDueCatalogRetries, finishCatalogRetry, scheduleCatalogRetry } from "./supplier-catalog-retry.ts";
import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { recordCatalogAlert, resolveCatalogAlerts } from "./supplier-catalog-alerts.ts";

type SyncResult = { status: "accepted" | "rejected" | "failed" | "skipped"; id: string; errorCode?: string };
type Sync = (world: SupplierCatalogWorld, source: "manual" | "scheduled" | "retry", runId: string) => Promise<SyncResult>;

function runtimeSync(db: D1Database): Sync {
  return async (world, source, runId) => {
    const result = await syncSupplierCatalogWorld(db, world, source, { runId });
    return { status: result.status as SyncResult["status"], id: result.id,
      ...("errorCode" in result && result.errorCode ? { errorCode: result.errorCode } : {}) };
  };
}

function after(date: Date, milliseconds: number) {
  return new Date(date.getTime() + milliseconds).toISOString();
}

async function settleInitial(db: D1Database, rootRunId: string, result: SyncResult, now: string) {
  if (result.status === "accepted" || result.status === "rejected" || result.status === "skipped") {
    await cancelPendingCatalogRetries(db, rootRunId, now, result.status, result.id, result.errorCode);
  }
}

async function settleAlerts(db: D1Database, input: { rootRunId: string; world: SupplierCatalogWorld; result: SyncResult; now: string; exhausted?: boolean }) {
  try {
    if (input.result.status === "accepted") await resolveCatalogAlerts(db, input.world, input.now);
    else if (input.result.status === "rejected") await recordCatalogAlert(db, { rootRunId: input.rootRunId,
      runId: input.result.id, world: input.world, severity: "warning", kind: "review_required",
      errorCode: input.result.errorCode, now: input.now });
    else if (input.result.status === "failed" && input.exhausted) await recordCatalogAlert(db, { rootRunId: input.rootRunId,
      runId: input.result.id, world: input.world, severity: "critical", kind: "retries_exhausted",
      errorCode: input.result.errorCode, now: input.now });
  } catch (error) { console.error("VII catalog alert persistence unavailable", input.world, input.result.id, error); }
}

export async function runCatalogPullWithRetryPlan(db: D1Database, input: {
  world: SupplierCatalogWorld;
  source: "manual" | "scheduled";
  runId: string;
  now?: Date;
  sync?: Sync;
}) {
  const now = input.now || new Date();
  const sync = input.sync || runtimeSync(db);
  await scheduleCatalogRetry(db, { rootRunId: input.runId, world: input.world, attempt: 1,
    dueAt: after(now, CATALOG_RETRY_DELAY_MS), createdAt: now.toISOString() });
  const result = await sync(input.world, input.source, input.runId);
  await settleInitial(db, input.runId, result, now.toISOString());
  await settleAlerts(db, { rootRunId: input.runId, world: input.world, result, now: now.toISOString() });
  return result;
}

export async function runDueCatalogRetries(db: D1Database, input: { now?: Date; sync?: Sync; limit?: number } = {}) {
  const now = input.now || new Date();
  const sync = input.sync || runtimeSync(db);
  const jobs = await claimDueCatalogRetries(db, now.toISOString(), input.limit);
  const results: SyncResult[] = [];
  for (const job of jobs) {
    if (job.attempt < CATALOG_MAX_RETRIES) await scheduleCatalogRetry(db, { rootRunId: job.rootRunId,
      world: job.world, attempt: job.attempt + 1, dueAt: after(now, CATALOG_RETRY_DELAY_MS), createdAt: now.toISOString() });
    const runId = `${job.rootRunId}_retry_${job.attempt}`;
    const result = await sync(job.world, "retry", runId);
    const terminalStatus = result.status === "failed" && job.attempt === CATALOG_MAX_RETRIES ? "exhausted" :
      result.status === "rejected" ? "cancelled" : "completed";
    await finishCatalogRetry(db, { id: job.id, status: terminalStatus, finishedAt: now.toISOString(),
      resultStatus: result.status, resultRunId: result.id, errorCode: result.errorCode });
    if (result.status === "accepted" || result.status === "rejected") {
      await cancelPendingCatalogRetries(db, job.rootRunId, now.toISOString(), result.status, result.id, result.errorCode);
    }
    await settleAlerts(db, { rootRunId: job.rootRunId, world: job.world, result, now: now.toISOString(), exhausted: terminalStatus === "exhausted" });
    results.push(result);
  }
  return results;
}

export async function runSupplierCatalogScheduleTick(db: D1Database, input: { now?: Date; sync?: Sync } = {}) {
  const now = input.now || new Date();
  const retries = await runDueCatalogRetries(db, { now, sync: input.sync });
  const exactWorld = scheduledCatalogWorld(now);
  const recoveryWorld = !exactWorld && !retries.length ? catalogWorlds[Math.floor(now.getUTCMinutes() / 10) % catalogWorlds.length] : null;
  const recoverySlot = recoveryWorld ? catalogPullSlot(now, recoveryWorld) : null;
  const due = exactWorld ? [{ world: exactWorld, runId: scheduledCatalogRunId(now, exactWorld) }]
    : recoveryWorld && recoverySlot ? [{ world: recoveryWorld, runId: recoverySlot.id }] : [];
  const scheduled: SyncResult[] = [];
  for (const item of due) scheduled.push(await runCatalogPullWithRetryPlan(db, {
    world: item.world, source: "scheduled", runId: item.runId, now, sync: input.sync,
  }));
  return { primary: scheduled.find((result) => result.status !== "skipped") || scheduled[0] || null, scheduled, retries };
}
