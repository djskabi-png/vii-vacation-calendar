import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { readQualityDashboard, readQualityRunStatus, runQualityChecks, persistQualityJobProgress, updateQualityIncident, updateQualitySchedule, type QualityNotificationEnvironment, type QualityRunLevel } from "../../../lib/quality-platform.ts";
import { requiredRuntimeDatabase } from "../../../lib/runtime-database.ts";
import { createManualQualityJob, consumeQualityJob } from "../../../lib/quality-job-platform.ts";
import { ensureQualityJobSchema, readQualityJob, requestQualityJobCancel } from "../../../lib/quality-job-store.ts";
import { getRequestExecutionContext } from "vinext/shims/request-context";
import type { QualityJob } from "../../../lib/quality-job-store.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

function jobView(job: QualityJob) {
  const terminal = !["queued", "running"].includes(job.status);
  return { runId: job.runId, status: job.status, nextIndex: job.nextIndex, totalChecks: job.checks.length,
    sourceVersion: job.sourceVersion, reason: job.reason,
    passedCount: job.receipts.filter(receipt => receipt.status === "passed").length,
    attentionCount: job.receipts.filter(receipt => receipt.status !== "passed").length,
    // In-flight polling transfers counters only. Definitions, actor and full
    // observations remain on the server until the terminal result is read.
    receipts: terminal ? job.receipts : [],
  };
}

async function notificationEnvironment(): Promise<QualityNotificationEnvironment> {
  try {
    const runtimeName = "cloudflare:workers";
    const runtime = await import(/* @vite-ignore */ runtimeName);
    return (runtime.env || {}) as QualityNotificationEnvironment;
  } catch {
    return process.env as QualityNotificationEnvironment;
  }
}

export async function GET(request: Request) {
  if (!await authorizedAdminSession(request).catch(() => null)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  const query = new URL(request.url).searchParams;
  try {
    const db = await requiredRuntimeDatabase("quality_database_unavailable");
    if (query.has("jobId")) {
      const jobId = query.get("jobId") ?? "";
      if (!/^[A-Za-z0-9-]{8,120}$/.test(jobId)) return Response.json({ error: "invalid_job_id" }, { status: 400, headers });
      await ensureQualityJobSchema(db);
      const job = await readQualityJob(db, jobId);
      return Response.json({ job: job ? jobView(job) : null }, { status: job ? 200 : 404, headers });
    }
    if (query.has("runId") || query.get("active") === "1") {
      const runId = query.get("runId") || undefined;
      if (runId && (runId.length > 120 || !/^[A-Za-z0-9:_-]+$/.test(runId))) return Response.json({ error: "invalid_run_id" }, { status: 400, headers });
      return Response.json(await readQualityRunStatus(db, { runId, activeOnly: !runId }), { headers });
    }
    return Response.json(await readQualityDashboard(db, await notificationEnvironment()), { headers });
  }
  catch { return Response.json({ error: "quality_unavailable" }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  const body = await request.json().catch(() => null) as { action?: unknown; incidentId?: unknown; level?: unknown; checkId?: unknown; cadenceMinutes?: unknown; scope?: unknown; idempotencyKey?: unknown; jobId?: unknown } | null;
  try {
    const db = await requiredRuntimeDatabase("quality_database_unavailable");
    if (body?.action === "enqueue") {
      if (typeof body.idempotencyKey !== "string" || !/^[A-Za-z0-9:_-]{8,120}$/.test(body.idempotencyKey)) return Response.json({ error: "invalid_idempotency_key" }, { status: 400, headers });
      const context = getRequestExecutionContext();
      if (!context) return Response.json({ error: "quality_job_runner_unavailable" }, { status: 503, headers });
      const level: QualityRunLevel = body.level === "regular" || body.level === "medium" || body.level === "full" ? body.level : "full";
      // Scoped automation remains on the strict legacy path until its UI and
      // complete dependency selection are wired. Never silently ignore scope.
      if (Object.prototype.hasOwnProperty.call(body, "scope")) return Response.json({ error: "quality_job_scope_not_supported" }, { status: 400, headers });
      const queued = await createManualQualityJob(db, { actor: session.email, idempotencyKey: body.idempotencyKey, origin: new URL(request.url).origin, level });
      if (queued.job.status === "queued") context.waitUntil(consumeQualityJob(db, queued.job.runId).catch(() => undefined));
      return Response.json({ job: jobView(queued.job), duplicate: queued.duplicate }, { status: 202, headers });
    }
    if (body?.action === "resume-job" || body?.action === "cancel-job") {
      if (typeof body.jobId !== "string" || !/^[A-Za-z0-9-]{8,120}$/.test(body.jobId)) return Response.json({ error: "invalid_job_id" }, { status: 400, headers });
      await ensureQualityJobSchema(db);
      const job = await readQualityJob(db, body.jobId);
      if (!job) return Response.json({ error: "job_not_found" }, { status: 404, headers });
      if (body.action === "cancel-job") {
        await requestQualityJobCancel(db, job.runId);
        const cancelled = await readQualityJob(db, job.runId);
        if (cancelled) await persistQualityJobProgress(db, cancelled);
      }
      else {
        const context = getRequestExecutionContext();
        if (!context) return Response.json({ error: "quality_job_runner_unavailable" }, { status: 503, headers });
        if (job.status === "queued") context.waitUntil(consumeQualityJob(db, job.runId).catch(() => undefined));
      }
      const saved = await readQualityJob(db, job.runId);
      return Response.json({ job: saved ? jobView(saved) : null }, { status: 202, headers });
    }
    if (body?.action === "run") {
      const level: QualityRunLevel = body.level === "regular" || body.level === "medium" || body.level === "full" ? body.level : "full";
      const hasScope = Object.prototype.hasOwnProperty.call(body || {}, "scope");
      const rawScope = hasScope && body.scope && typeof body.scope === "object" && !Array.isArray(body.scope)
        ? body.scope as Record<string, unknown>
        : null;
      const changedBoxes = rawScope?.changedBoxes;
      const consumers = rawScope?.consumers;
      const scope = Array.isArray(changedBoxes) && changedBoxes.every((value) => typeof value === "string" && value.length < 120)
        && (!consumers || Array.isArray(consumers) && consumers.every((value) => typeof value === "string" && value.length < 160))
        && (!rawScope?.unknownOwner || typeof rawScope.unknownOwner === "boolean")
        ? { changedBoxes: changedBoxes as string[], consumers: (consumers as string[] | undefined), unknownOwner: rawScope?.unknownOwner as boolean | undefined }
        : undefined;
      if (hasScope && !scope) return Response.json({ error: "invalid_scope" }, { status: 400, headers });
      return Response.json({ run: await runQualityChecks(db, { origin: new URL(request.url).origin, trigger: "manual", level, scope, actor: session.email, notificationEnv: await notificationEnvironment() }) }, { headers });
    }
    if ((body?.action === "acknowledge" || body?.action === "resolve" || body?.action === "reopen") && typeof body.incidentId === "string" && body.incidentId.length < 100) {
      return Response.json({ incident: await updateQualityIncident(db, { incidentId: body.incidentId, action: body.action, actor: session.email }) }, { headers });
    }
    if (body?.action === "schedule" && typeof body.checkId === "string" && body.checkId.length < 120 && Number.isInteger(body.cadenceMinutes)) {
      return Response.json({ schedule: await updateQualitySchedule(db, { checkId: body.checkId, cadenceMinutes: Number(body.cadenceMinutes), actor: session.email }) }, { headers });
    }
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  } catch (error) {
    if (error instanceof Error && error.message === "quality_job_idempotency_conflict") return Response.json({ error: error.message }, { status: 409, headers });
    return Response.json({ error: "quality_unavailable" }, { status: 503, headers });
  }
}
