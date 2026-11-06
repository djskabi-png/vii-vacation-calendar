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

/** Private controllers select the application generation from their trusted
 * runtime environment. A caller's JSON body never supplies this value. */
export function qualityTargetBuild(buildId: unknown): string {
  if (typeof buildId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(buildId)) throw new Error('quality_target_build_invalid');
  return buildId;
}
type JobGeneration = { targetBuildId?: string };
function selectedBuild(options: JobGeneration) {
  return Object.hasOwn(options, 'targetBuildId') ? qualityTargetBuild(options.targetBuildId) : qualityBuildIdentity();
}

export function qualityHttpJobCheckSnapshot(check: QualityCheck, origin: string, level: QualityRunLevel, context?: { trigger?: "scheduled"; requestScope?: { changedBoxes: string[]; consumers?: string[]; unknownOwner?: boolean } }): QualityJobCheck {
  return { checkId: check.checkId, definitionVersion: "http-contract-v2", timeoutMs: check.timeoutMs, configuration: { check: structuredClone(check), scope: { ...structuredClone(qualityScopeMetadata[check.checkId]), costBudgetMs: check.timeoutMs }, origin, level, ...(context?.trigger ? { trigger: context.trigger } : {}), ...(context?.requestScope ? { requestScope: structuredClone(context.requestScope) } : {}) } };
}

export async function createManualQualityJob(db: D1Database, input: {
  actor: string; idempotencyKey: string; origin: string; level: QualityRunLevel;
  scope?: { changedBoxes: string[]; consumers?: string[]; unknownOwner?: boolean };
}, options: JobGeneration = {}) {
  const targetBuildId = selectedBuild(options);
  const scope = input.scope ? { changedBoxes: [...input.scope.changedBoxes], ...(input.scope.consumers !== undefined ? { consumers: [...input.scope.consumers] } : {}), ...(input.scope.unknownOwner !== undefined ? { unknownOwner: input.scope.unknownOwner } : {}) } : undefined;
  const checks = selectManualQualityChecks(input.level, scope).map(check => qualityHttpJobCheckSnapshot(check, input.origin, input.level, scope ? { requestScope: scope } : undefined));
  const queued = await enqueueQualityJob(db, { actor: input.actor, idempotencyKey: input.idempotencyKey,
    payload: { level: input.level, scope: scope ?? null }, sourceVersion: targetBuildId,
    definitionVersion: await payloadHash(checks), checks });
  await persistQualityJobProgress(db, queued.job);
  return queued;
}

export async function createScheduledQualityJob(db: D1Database, input: { actor: string; idempotencyKey: string; origin: string; checkId: string }, options: JobGeneration = {}) {
  const targetBuildId = selectedBuild(options);
  const check = selectManualQualityChecks("full").find(check => check.checkId === input.checkId);
  if (!check) throw new Error("quality_schedule_definition_missing");
  const checks = [qualityHttpJobCheckSnapshot(check, input.origin, "regular", { trigger: "scheduled" })];
  const queued = await enqueueQualityJob(db, { actor: input.actor, idempotencyKey: input.idempotencyKey, payload: { trigger: "scheduled", checkId: input.checkId }, sourceVersion: targetBuildId, definitionVersion: await payloadHash(checks), checks });
  await persistQualityJobProgress(db, queued.job);
  return queued;
}

export async function consumeQualityJob(db: D1Database, runId: string, options: JobGeneration & { fetcher?: typeof fetch; budgetMs?: number; notificationEnv?: QualityNotificationEnvironment } = {}) {
  const targetBuildId = selectedBuild(options);
  const job = await readQualityJob(db, runId);
  if (!job) return null;
  const current = selectManualQualityChecks("full");
  const definitions = job.checks.map(saved => {
    const check = current.find(check => check.checkId === saved.checkId);
    const level = saved.configuration.level;
    return check && (level === "full" || level === "medium" || level === "regular") ? qualityHttpJobCheckSnapshot(check, String(saved.configuration.origin), level, { ...(saved.configuration.trigger === "scheduled" ? { trigger: "scheduled" as const } : {}), ...(saved.configuration.requestScope ? { requestScope: saved.configuration.requestScope as { changedBoxes: string[]; consumers?: string[]; unknownOwner?: boolean } } : {}) }) : null;
  });
  const definitionVersion = definitions.every(Boolean) ? await payloadHash(definitions) : "unmapped-current-definition";
  const outcome = await runQualityJobSlice(db, { runId, leaseToken: crypto.randomUUID(), sourceVersion: targetBuildId, definitionVersion,
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
