import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { isCatalogWorld } from "../../../lib/supplier-catalog-runtime.ts";
import { runCatalogPullWithRetryPlan } from "../../../lib/supplier-catalog-retry-runner.ts";
import { readCatalogRetryJobs } from "../../../lib/supplier-catalog-retry.ts";
import { readSupplierCatalogDashboard } from "../../../lib/supplier-catalog-store.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { catalogFreshnessAlerts, readCatalogAlerts } from "../../../lib/supplier-catalog-alerts.ts";
import { requiredRuntimeDatabase, runtimeD1Database } from "../../../lib/runtime-database.ts";
import { readCachedOnlineCapabilities } from "../../../lib/online-booking-capability-cache.ts";
import { publicOnlineCapabilities } from "../../../lib/online-booking-capability.ts";
import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";

const headers = { "Cache-Control": "no-store" };

async function authorized(request: Request) {
  try {
    const session = await authorizedAdminSession(request);
    return !!session;
  } catch { return false; }
}

async function database(): Promise<D1Database> {
  return requiredRuntimeDatabase("catalog_database_unavailable");
}

export async function GET(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    let db = await database();
    // Locks and active generations are the safety-critical core. Optional
    // diagnostics must never turn a healthy catalog into an opaque 503 screen.
    let dashboard;
    let databaseOrigin: "aws-aurora" | "cloudflare-d1" = "aws-aurora";
    let degraded = false;
    try {
      dashboard = await readSupplierCatalogDashboard(db);
    } catch (primaryError) {
      const fallback = await runtimeD1Database();
      if (fallback === db) throw primaryError;
      console.error("catalog_dashboard_using_d1_fallback", {
        reason: primaryError instanceof Error ? primaryError.message.slice(0, 160) : "unknown",
      });
      db = fallback;
      dashboard = await readSupplierCatalogDashboard(db);
      databaseOrigin = "cloudflare-d1";
      degraded = true;
    }
    const [retryJobsResult, alertsResult, capabilityResult, vacationIdsResult] = await Promise.allSettled([
      readCatalogRetryJobs(db), readCatalogAlerts(db), readCachedOnlineCapabilities(db), publishedSupplierIds("vacations"),
    ]);
    const retryJobs = retryJobsResult.status === "fulfilled" ? retryJobsResult.value : [];
    const storedAlerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];
    const capabilitySnapshot = capabilityResult.status === "fulfilled" ? capabilityResult.value : null;
    const vacationIds = vacationIdsResult.status === "fulfilled" ? vacationIdsResult.value : new Set<number>();
    const alerts = [...catalogFreshnessAlerts(dashboard.states), ...storedAlerts];
    const capabilityValue = capabilitySnapshot
      ? publicOnlineCapabilities(capabilitySnapshot.value, vacationIds)
      : {};
    return Response.json({ ...dashboard, databaseOrigin, degraded, retryJobs, alerts, diagnosticsAvailability: {
      retries: retryJobsResult.status === "fulfilled",
      alerts: alertsResult.status === "fulfilled",
      onlineCapabilities: capabilityResult.status === "fulfilled",
      publishedVacationIds: vacationIdsResult.status === "fulfilled",
    }, onlineCapabilities: capabilitySnapshot ? {
      status: capabilitySnapshot.cache.status,
      checkedAt: capabilitySnapshot.cache.checkedAt,
      count: Object.keys(capabilityValue).length,
      targetFreshMinutes: 30,
      lastGoodMaxDays: 30,
    } : null }, { headers });
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
