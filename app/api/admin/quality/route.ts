import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { readQualityDashboard, readQualityRunStatus, runQualityChecks, updateQualityIncident, updateQualitySchedule, type QualityNotificationEnvironment, type QualityRunLevel } from "../../../lib/quality-platform.ts";
import { requiredRuntimeDatabase } from "../../../lib/runtime-database.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

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
  const body = await request.json().catch(() => null) as { action?: unknown; incidentId?: unknown; level?: unknown; checkId?: unknown; cadenceMinutes?: unknown; scope?: unknown } | null;
  try {
    const db = await requiredRuntimeDatabase("quality_database_unavailable");
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
  } catch { return Response.json({ error: "quality_unavailable" }, { status: 503, headers }); }
}
