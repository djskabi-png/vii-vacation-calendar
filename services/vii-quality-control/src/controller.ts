import type { D1Database } from "../../../types/cloudflare-runtime";
import { readQualityDashboard, readQualityRunStatus, readQualityScopeOptions, persistQualityJobProgress, updateQualityIncident, updateQualitySchedule, type QualityRunLevel } from "../../../app/lib/quality-platform.ts";
import { ensureQualityJobSchema, readQualityJob, readQualityJobByIntent, requestQualityJobCancel, type QualityJob } from "../../../app/lib/quality-job-store.ts";
import { ensureDispatchSchema, reserveDispatch, dispatchWithTransport, recoverExpiredDispatches } from "./dispatch-outbox.ts";

export type QueueMessage = { version: 1; runId: string; expectedIndex: number; sourceVersion: string; priority: "release" | "monitor" };
export type ControllerEnvironment = { QUALITY_DB: D1Database; RELEASE_QUEUE: { send(message: QueueMessage): Promise<void> }; MONITOR_QUEUE: { send(message: QueueMessage): Promise<void> }; EXECUTION_ENABLED?: string };
export type ControllerPlatform = {
  create(db: D1Database, input: { actor: string; idempotencyKey: string; origin: string; level: QualityRunLevel; scope?: { changedBoxes: string[]; consumers?: string[]; unknownOwner?: boolean } }): Promise<{ job: QualityJob; duplicate: boolean }>;
  consume(db: D1Database, runId: string): Promise<unknown>;
};
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
export function jobView(job: QualityJob) {
  return { runId: job.runId, status: job.status, nextIndex: job.nextIndex, totalChecks: job.checks.length, sourceVersion: job.sourceVersion, reason: job.reason,
    passedCount: job.receipts.filter(r => r.status === "passed").length, attentionCount: job.receipts.filter(r => r.status !== "passed").length,
    receipts: ["queued", "running"].includes(job.status) ? [] : job.receipts };
}
function scopeValue(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid_scope");
  const value = raw as Record<string, unknown>;
  const names = (items: unknown): items is string[] => Array.isArray(items) && items.length <= 100 && items.every(x => typeof x === "string" && x.length > 0 && x.length <= 160);
  if (!names(value.changedBoxes) || (value.consumers !== undefined && !names(value.consumers)) || (value.unknownOwner !== undefined && typeof value.unknownOwner !== "boolean")) throw new Error("invalid_scope");
  return { changedBoxes: value.changedBoxes.map(x => x === "world-landings" ? "vacations" : x), ...(value.consumers !== undefined ? { consumers: value.consumers as string[] } : {}), ...(value.unknownOwner !== undefined ? { unknownOwner: value.unknownOwner as boolean } : {}) };
}

/** The authenticated gateway supplies the actor only after a verified, request-bound
 * attestation. This module never reads a cookie, accepts a browser actor, executes
 * checks on GET/POST, or sends a notification from an HTTP request. */
export function createController(platform: ControllerPlatform) {
  async function dispatch(env: ControllerEnvironment, job: QualityJob, priority: QueueMessage["priority"] = "release") {
    if (env.EXECUTION_ENABLED !== "true" || job.status !== "queued") return;
    await ensureDispatchSchema(env.QUALITY_DB);
    const row = await reserveDispatch(env.QUALITY_DB, { runId: job.runId, expectedIndex: job.nextIndex, sourceVersion: job.sourceVersion, priority });
    if (!row) throw new Error("dispatch_not_reserved");
    const message: QueueMessage = { version: 1, runId: job.runId, expectedIndex: job.nextIndex, sourceVersion: job.sourceVersion, priority };
    const sent = await dispatchWithTransport(env.QUALITY_DB, row.dispatchId, crypto.randomUUID(), () => (priority === "release" ? env.RELEASE_QUEUE : env.MONITOR_QUEUE).send(message));
    if (sent.status === "uncertain") {
      // A late delivery will observe blocked and execute nothing. Never change
      // a run already owned by an active consumer based on an unknown send ack.
      await env.QUALITY_DB.prepare("UPDATE quality_jobs SET status='blocked',reason='queue_dispatch_unverified',updated_at=? WHERE run_id=? AND status='queued' AND next_index=? AND active_index IS NULL")
        .bind(new Date().toISOString(), job.runId, job.nextIndex).run();
      const saved = await readQualityJob(env.QUALITY_DB, job.runId);
      if (saved) await persistQualityJobProgress(env.QUALITY_DB, saved);
    }
  }
  async function handle(request: Request, env: ControllerEnvironment, actor: string, body?: Record<string, unknown> | null) {
    if (!actor || actor.length > 320) return json({ error: "forbidden" }, 403);
    const url = new URL(request.url);
    if (url.pathname !== "/api/admin/quality") return json({ error: "not_found" }, 404);
    if (!["GET", "POST"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
    try {
      const db = env.QUALITY_DB;
      if (request.method === "GET") {
        if (url.searchParams.get("scope") === "metadata") return json(readQualityScopeOptions());
        if (url.searchParams.has("intentKey")) {
          const key = url.searchParams.get("intentKey") || "";
          if (!/^[A-Za-z0-9:_-]{8,120}$/.test(key)) return json({ error: "invalid_idempotency_key" }, 400);
          const job = await readQualityJobByIntent(db, actor, key);
          return json({ job: job ? jobView(job) : null }, job ? 200 : 404);
        }
        if (url.searchParams.has("jobId")) {
          const id = url.searchParams.get("jobId") || "";
          if (!/^[A-Za-z0-9-]{8,120}$/.test(id)) return json({ error: "invalid_job_id" }, 400);
          await ensureQualityJobSchema(db);
          const job = await readQualityJob(db, id);
          return json({ job: job ? jobView(job) : null }, job ? 200 : 404);
        }
        if (url.searchParams.has("runId") || url.searchParams.get("active") === "1") {
          const id = url.searchParams.get("runId") || undefined;
          if (id && !/^[A-Za-z0-9:_-]{1,120}$/.test(id)) return json({ error: "invalid_run_id" }, 400);
          return json(await readQualityRunStatus(db, { runId: id, activeOnly: !id }));
        }
        return json(await readQualityDashboard(db));
      }
      if (!body) return json({ error: "invalid_request" }, 400);
      if (body.action === "enqueue") {
        // A disabled or incompletely provisioned controller cannot accept new
        // work and leave the interface reporting an indefinitely queued run.
        if (env.EXECUTION_ENABLED !== "true") return json({ error: "quality_job_runner_unavailable" }, 503);
        if (typeof body.idempotencyKey !== "string" || !/^[A-Za-z0-9:_-]{8,120}$/.test(body.idempotencyKey)) return json({ error: "invalid_idempotency_key" }, 400);
        if (body.level !== "full" && body.level !== "medium" && body.level !== "regular") return json({ error: "invalid_level" }, 400);
        const scope = Object.hasOwn(body, "scope") ? scopeValue(body.scope) : undefined;
        const queued = await platform.create(db, { actor, idempotencyKey: body.idempotencyKey, origin: url.origin, level: body.level, ...(scope ? { scope } : {}) });
        await dispatch(env, queued.job);
        const saved = await readQualityJob(db, queued.job.runId);
        return json({ job: jobView(saved ?? queued.job), duplicate: queued.duplicate }, 202);
      }
      if (body.action === "resume-job" || body.action === "cancel-job") {
        if (typeof body.jobId !== "string" || !/^[A-Za-z0-9-]{8,120}$/.test(body.jobId)) return json({ error: "invalid_job_id" }, 400);
        await ensureQualityJobSchema(db);
        const job = await readQualityJob(db, body.jobId);
        if (!job) return json({ error: "job_not_found" }, 404);
        if (body.action === "cancel-job") {
          await requestQualityJobCancel(db, job.runId);
          const saved = await readQualityJob(db, job.runId);
          if (saved) await persistQualityJobProgress(db, saved);
          return json({ job: saved ? jobView(saved) : null }, 202);
        }
        if (env.EXECUTION_ENABLED !== "true") return json({ error: "quality_job_runner_unavailable" }, 503);
        await dispatch(env, job);
        return json({ job: jobView(await readQualityJob(db, job.runId) ?? job) }, 202);
      }
      if (["acknowledge", "resolve", "reopen"].includes(String(body.action)) && typeof body.incidentId === "string" && body.incidentId.length < 100) return json({ incident: await updateQualityIncident(db, { incidentId: body.incidentId, action: body.action as "acknowledge" | "resolve" | "reopen", actor }) });
      if (body.action === "schedule" && typeof body.checkId === "string" && Number.isInteger(body.cadenceMinutes)) return json({ schedule: await updateQualitySchedule(db, { checkId: body.checkId, cadenceMinutes: Number(body.cadenceMinutes), actor }) });
      return json({ error: "invalid_request" }, 400);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "quality_job_idempotency_conflict" || code === "dispatch_immutable_conflict") return json({ error: code }, 409);
      if (["invalid_scope", "invalid_quality_schedule", "quality_scope_unmapped", "quality_scope_level_incomplete", "quality_scope_empty"].includes(code)) return json({ error: code }, 400);
      return json({ error: "quality_unavailable" }, 503);
    }
  }
  async function consume(env: ControllerEnvironment, message: unknown) {
    if (env.EXECUTION_ENABLED !== "true") throw new Error("quality_execution_disabled");
    if (!message || typeof message !== "object") throw new Error("invalid_queue_message");
    const value = message as QueueMessage;
    if (value.version !== 1 || !/^[A-Za-z0-9-]{8,120}$/.test(value.runId) || !Number.isSafeInteger(value.expectedIndex) || value.expectedIndex < 0 || typeof value.sourceVersion !== "string" || !["release", "monitor"].includes(value.priority)) throw new Error("invalid_queue_message");
    await ensureQualityJobSchema(env.QUALITY_DB);
    const job = await readQualityJob(env.QUALITY_DB, value.runId);
    if (!job || job.sourceVersion !== value.sourceVersion || job.nextIndex !== value.expectedIndex || !["queued", "running"].includes(job.status)) return { status: "obsolete" };
    // The durable runner owns the execution lease and commit fence. Duplicate
    // Queue deliveries cannot execute an already committed check again.
    const result = await platform.consume(env.QUALITY_DB, job.runId);
    const saved = await readQualityJob(env.QUALITY_DB, job.runId);
    if (saved && saved.nextIndex > value.expectedIndex) await dispatch(env, saved, value.priority);
    return result;
  }
  async function recover(env: ControllerEnvironment) {
    await ensureDispatchSchema(env.QUALITY_DB);
    await recoverExpiredDispatches(env.QUALITY_DB);
    // Repair the commit-before-dispatch gap only. An uncertain send keeps its
    // original reservation and is never converted into another network send.
    await ensureQualityJobSchema(env.QUALITY_DB);
    const rows = await env.QUALITY_DB.prepare("SELECT jobs.run_id AS runId,COALESCE(outbox.priority,'release') AS priority FROM quality_jobs AS jobs LEFT JOIN quality_dispatch_outbox AS outbox ON outbox.run_id=jobs.run_id AND outbox.expected_index=jobs.next_index WHERE jobs.status='queued' ORDER BY jobs.created_at LIMIT 2").all<{ runId: string; priority: QueueMessage['priority'] }>();
    for (const row of rows.results) { const job = await readQualityJob(env.QUALITY_DB, row.runId); if (job) await dispatch(env, job, row.priority); }
  }
  return { handle, consume, recover, dispatch };
}
