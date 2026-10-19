import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { isCatalogWorld } from "../../../lib/supplier-catalog-runtime.ts";
import { runCatalogPullWithRetryPlan } from "../../../lib/supplier-catalog-retry-runner.ts";
import { readCatalogRetryJobs } from "../../../lib/supplier-catalog-retry.ts";
import { readSupplierCatalogDashboard } from "../../../lib/supplier-catalog-store.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { catalogFreshnessAlerts, readCatalogAlerts } from "../../../lib/supplier-catalog-alerts.ts";

const headers = { "Cache-Control": "no-store" };

async function authorized(request: Request) {
  try {
    const session = await authorizedAdminSession(request);
    return !!session;
  } catch { return false; }
}

async function database(): Promise<D1Database> {
  const runtime = await import("cloudflare:workers");
  const db = (runtime.env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("catalog_database_unavailable");
  return db;
}

export async function GET(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const db = await database();
    const [dashboard, retryJobs, storedAlerts] = await Promise.all([readSupplierCatalogDashboard(db), readCatalogRetryJobs(db), readCatalogAlerts(db)]);
    const alerts = [...catalogFreshnessAlerts(dashboard.states), ...storedAlerts];
    return Response.json({ ...dashboard, retryJobs, alerts }, { headers });
  }
  catch (error) {
    console.error("VII catalog dashboard unavailable", error);
    return Response.json({ error: "catalog_dashboard_unavailable" }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  }
  let payload: unknown;
  try { payload = await request.json(); } catch { return Response.json({ error: "invalid_request" }, { status: 400, headers }); }
  const world = payload && typeof payload === "object" && "world" in payload ? payload.world : null;
  if (!isCatalogWorld(world)) return Response.json({ error: "invalid_world" }, { status: 400, headers });
  try {
    const runId = `manual_${Date.now()}_${world}_${crypto.randomUUID().replaceAll("-", "")}`;
    const result = await runCatalogPullWithRetryPlan(await database(), { world, source: "manual", runId });
    return Response.json(result, { status: result.status === "accepted" ? 200 : 409, headers });
  } catch (error) {
    console.error("VII catalog sync unavailable", world, error);
    return Response.json({ error: "catalog_sync_unavailable" }, { status: 503, headers });
  }
}
