import type { D1Database } from "../../types/cloudflare-runtime";
import { executeQualityCheck, selectManualQualityChecks, persistQualityJobProgress, type QualityCheck, type QualityRunLevel, type QualityNotificationEnvironment } from "./quality-platform.ts";
import { enqueueQualityJob, readQualityJob, payloadHash, dueQualityJobIds, type QualityJobCheck } from "./quality-job-store.ts";
import { runQualityJobSlice } from "./quality-job-runner.ts";
import { qualityScopeMetadata } from "./quality-check-scope.ts";

declare const __VII_CACHE_BUILD_ID__: string;
export function qualityBuildIdentity() {
  if (typeof __VII_CACHE_BUILD_ID__ !== "string" || !__VII_CACHE_BUILD_ID__) throw new Error("quality_build_identity_unavailable");
  return __VII_CACHE_BUILD_ID__;
}

function snapshot(check: QualityCheck, origin: string, level: QualityRunLevel): QualityJobCheck {
  return { checkId: check.checkId, definitionVersion: "http-contract-v2", timeoutMs: check.timeoutMs, configuration: { check: structuredClone(check), scope: { ...structuredClone(qualityScopeMetadata[check.checkId]), costBudgetMs: check.timeoutMs }, origin, level } };
}

export async function createManualQualityJob(db: D1Database, input: {
  actor: string; idempotencyKey: string; origin: string; level: QualityRunLevel;
  scope?: { changedBoxes: string[]; consumers?: string[]; unknownOwner?: boolean };
}) {
  const checks = selectManualQualityChecks(input.level, input.scope).map(check => snapshot(check, input.origin, input.level));
  const queued = await enqueueQualityJob(db, { actor: input.actor, idempotencyKey: input.idempotencyKey,
    payload: { level: input.level, scope: input.scope ?? null }, sourceVersion: qualityBuildIdentity(),
    definitionVersion: await payloadHash(checks), checks });
  await persistQualityJobProgress(db, queued.job);
  return queued;
}

export async function consumeQualityJob(db: D1Database, runId: string, options: { fetcher?: typeof fetch; budgetMs?: number; notificationEnv?: QualityNotificationEnvironment } = {}) {
  const job = await readQualityJob(db, runId);
  if (!job) return null;
  const current = selectManualQualityChecks("full");
  const definitions = job.checks.map(saved => {
    const check = current.find(check => check.checkId === saved.checkId);
    const level = saved.configuration.level;
    return check && (level === "full" || level === "medium" || level === "regular") ? snapshot(check, String(saved.configuration.origin), level) : null;
  });
  const definitionVersion = definitions.every(Boolean) ? await payloadHash(definitions) : "unmapped-current-definition";
  const outcome = await runQualityJobSlice(db, { runId, leaseToken: crypto.randomUUID(), sourceVersion: qualityBuildIdentity(), definitionVersion,
    budgetMs: options.budgetMs ?? 20_000, checkTimeoutMs: 14_000,
    execute: async (entry, signal) => {
      const check = entry.configuration.check as QualityCheck;
      if (check.checkId !== entry.checkId) throw new Error("quality_job_snapshot_mismatch");
      const result = await executeQualityCheck(check, String(entry.configuration.origin), options.fetcher ?? fetch, signal);
      return { status: result.status, observed: result.observed, statusCode: result.statusCode, durationMs: result.durationMs, evidenceUrl: result.url };
    },
  });
  const saved = await readQualityJob(db, runId);
  if (saved) await persistQualityJobProgress(db, saved, options.notificationEnv, options.fetcher);
  return outcome;
}

export async function resumeDueQualityJobs(db: D1Database, notificationEnv?: QualityNotificationEnvironment) {
  // A fixed, small admission budget protects public D1 traffic. No recursion
  // or detached promise chain. The scheduler resumes later if work remains.
  const ids = await dueQualityJobIds(db);
  const outcomes = [];
  for (const runId of ids) outcomes.push({ runId, outcome: await consumeQualityJob(db, runId, { budgetMs: 20_000, notificationEnv }) });
  return outcomes;
}
