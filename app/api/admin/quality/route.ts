import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { readQualityDashboard, runQualityChecks, updateQualityIncident, type QualityNotificationEnvironment, type QualityRunLevel } from "../../../lib/quality-platform.ts";
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
  try { return Response.json(await readQualityDashboard(await requiredRuntimeDatabase("quality_database_unavailable"), await notificationEnvironment()), { headers }); }
  catch { return Response.json({ error: "quality_unavailable" }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  const body = await request.json().catch(() => null) as { action?: unknown; incidentId?: unknown; level?: unknown } | null;
  try {
    const db = await requiredRuntimeDatabase("quality_database_unavailable");
    if (body?.action === "run") {
      const level: QualityRunLevel = body.level === "regular" || body.level === "medium" || body.level === "full" ? body.level : "full";
      return Response.json({ run: await runQualityChecks(db, { origin: new URL(request.url).origin, trigger: "manual", level, actor: session.email, notificationEnv: await notificationEnvironment() }) }, { headers });
    }
    if ((body?.action === "acknowledge" || body?.action === "resolve" || body?.action === "reopen") && typeof body.incidentId === "string" && body.incidentId.length < 100) {
      return Response.json({ incident: await updateQualityIncident(db, { incidentId: body.incidentId, action: body.action, actor: session.email }) }, { headers });
    }
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  } catch { return Response.json({ error: "quality_unavailable" }, { status: 503, headers }); }
}
