import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { isCatalogWorld } from "../../../lib/supplier-catalog-runtime.ts";
import { inspectSupplierCatalogWorld } from "../../../lib/supplier-catalog-runtime.ts";
import { syncSupplierCatalogWorld } from "../../../lib/supplier-catalog-runtime.ts";
import { runCatalogPullWithRetryPlan } from "../../../lib/supplier-catalog-retry-runner.ts";
import { readCatalogRetryJobs } from "../../../lib/supplier-catalog-retry.ts";
import { readSupplierCatalogArchive, readSupplierCatalogDashboard, readSupplierCatalogRunDiagnostics } from "../../../lib/supplier-catalog-store.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import type { R2Bucket } from "../../../../types/cloudflare-runtime";
import { catalogFreshnessAlerts, readCatalogAlerts } from "../../../lib/supplier-catalog-alerts.ts";
import { requiredRuntimeDatabase, runtimeD1Database } from "../../../lib/runtime-database.ts";
import { readCachedOnlineCapabilities } from "../../../lib/online-booking-capability-cache.ts";
import { publicOnlineCapabilities } from "../../../lib/online-booking-capability.ts";
import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { generatedInactiveBusinesses } from "../../../lib/inactive-business-archive.ts";

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

async function mediaArchive() {
  try {
    const runtime = await import("cloudflare:workers");
    const bucket = (runtime.env as unknown as { UPLOADS?: R2Bucket }).UPLOADS;
    return bucket ? { bucket } : undefined;
  } catch { return undefined; }
}

function archivedName(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "מקום ללא שם";
  const row = value as Record<string, unknown>;
  return [row.name, row.title].find((item): item is string => typeof item === "string" && item.trim().length > 0)?.trim() || "מקום ללא שם";
}

async function inactiveArchiveForAdmin(db: D1Database) {
  const runtime = (await Promise.all([0, 200, 400].map((offset) => readSupplierCatalogArchive(db, { limit: 200, offset })))).flat();
  const runtimeByIdentity = new Map(runtime.map((item) => [`${item.world}:${item.supplierId}`, item]));
  const rows = generatedInactiveBusinesses().flatMap((item) => {
    const runtimeItem = runtimeByIdentity.get(`${item.world}:${item.supplierId}`);
    if (runtimeItem?.status === "active") return [];
    return [{ world: item.world, supplierId: item.supplierId, name: runtimeItem ? archivedName(runtimeItem.summary) : item.name,
      canonicalPath: runtimeItem?.canonicalPath || item.canonicalPath, deactivatedAt: runtimeItem?.deactivatedAt || item.updatedAt || null,
      statusSource: runtimeItem?.statusSource || "legacy_recovery" }];
  });
  for (const item of runtime) if (item.status === "inactive" && !rows.some((row) => row.world === item.world && row.supplierId === item.supplierId)) {
    rows.push({ world: item.world, supplierId: item.supplierId, name: archivedName(item.summary), canonicalPath: item.canonicalPath,
      deactivatedAt: item.deactivatedAt, statusSource: item.statusSource });
  }
  return rows.sort((left, right) => left.world.localeCompare(right.world) || left.name.localeCompare(right.name, "he"));
}

export async function GET(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");
  const worldParam = url.searchParams.get("world");
  if (url.searchParams.get("candidate") === "1") {
    if (worldParam !== "vacations" && worldParam !== "events") return Response.json({ error: "invalid_world" }, { status: 400, headers });
    const target=url.searchParams.get('supplierId');
    if(target!==null&&(!/^[1-9]\d{0,9}$/.test(target)||!Number.isSafeInteger(Number(target))))return Response.json({error:'invalid_supplier_inspection'},{status:400,headers});
    try { return Response.json(await inspectSupplierCatalogWorld(await database(), worldParam,{supplierId:target===null?undefined:Number(target)}), { headers }); }
    catch (error) { if(error instanceof Error&&error.message==='invalid_supplier_inspection')return Response.json({error:'invalid_supplier_inspection'},{status:404,headers});console.error("VII catalog candidate inspection unavailable", error); return Response.json({ error: "catalog_candidate_unavailable" }, { status: 503, headers }); }
  }
  if (runId !== null || worldParam !== null) {
    if (!runId || !isCatalogWorld(worldParam) || !/^[A-Za-z0-9_-]{1,180}$/.test(runId)) {
      return Response.json({ error: "invalid_diagnostic_request" }, { status: 400, headers });
    }
    try {
      const result = await readSupplierCatalogRunDiagnostics(await database(), worldParam, runId);
      if (!result) return Response.json({ error: "diagnostics_not_found" }, { status: 404, headers });
      return Response.json(result, { headers });
    } catch (error) {
      console.error("VII catalog run diagnostics unavailable", error);
      return Response.json({ error: "catalog_diagnostics_unavailable" }, { status: 503, headers });
    }
  }
  try {
    let db = await database();
    // Locks and active generations are the safety-critical core. Optional
    // diagnostics must never turn a healthy catalog into an opaque 503 screen.
    let dashboard;
    let databaseOrigin: "cloudflare-d1" = "cloudflare-d1";
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
    const [retryJobsResult, alertsResult, capabilityResult, vacationIdsResult, inactiveArchiveResult] = await Promise.allSettled([
      readCatalogRetryJobs(db), readCatalogAlerts(db), readCachedOnlineCapabilities(db), publishedSupplierIds("vacations"), inactiveArchiveForAdmin(db),
    ]);
    const retryJobs = retryJobsResult.status === "fulfilled" ? retryJobsResult.value : [];
    const storedAlerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];
    const capabilitySnapshot = capabilityResult.status === "fulfilled" ? capabilityResult.value : null;
    const vacationIds = vacationIdsResult.status === "fulfilled" ? vacationIdsResult.value : new Set<number>();
    const alerts = [...catalogFreshnessAlerts(dashboard.states), ...storedAlerts];
    const capabilityValue = capabilitySnapshot
      ? publicOnlineCapabilities(capabilitySnapshot.value, vacationIds)
      : {};
    return Response.json({ ...dashboard, databaseOrigin, degraded, retryJobs, alerts,
      inactiveBusinesses: inactiveArchiveResult.status === "fulfilled" ? inactiveArchiveResult.value : generatedInactiveBusinesses().map((item) => ({
        world: item.world, supplierId: item.supplierId, name: item.name, canonicalPath: item.canonicalPath,
        deactivatedAt: item.updatedAt || null, statusSource: "legacy_recovery",
      })), diagnosticsAvailability: {
      retries: retryJobsResult.status === "fulfilled",
      alerts: alertsResult.status === "fulfilled",
      onlineCapabilities: capabilityResult.status === "fulfilled",
      publishedVacationIds: vacationIdsResult.status === "fulfilled",
      inactiveArchive: inactiveArchiveResult.status === "fulfilled",
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
  const target = payload && typeof payload === 'object' && 'supplierId' in payload ? payload.supplierId : undefined;
  if(target!==undefined&&((world!=='vacations'&&world!=='events')||typeof target!=='number'||!Number.isSafeInteger(target)||target<1||target>9_999_999_999))return Response.json({error:'invalid_supplier_refresh'},{status:400,headers});
  try {
    const runId = `manual_${Date.now()}_${world}_${crypto.randomUUID().replaceAll("-", "")}`;
    // A targeted detail refresh keeps the same complete-generation guards and
    // lock. It is a single explicit operation, never an automatic retry job.
    const archive = await mediaArchive();
    const result = target === undefined
      ? await runCatalogPullWithRetryPlan(await database(), { world, source: "manual", runId, mediaArchive: archive })
      : await syncSupplierCatalogWorld(await database(),world,'manual',{runId,detailSupplierId:target as number,mediaArchive:archive});
    return Response.json(result, { status: result.status === "accepted" ? 200 : 409, headers });
  } catch (error) {
    console.error("VII catalog sync unavailable", world, error);
    return Response.json({ error: "catalog_sync_unavailable" }, { status: 503, headers });
  }
}
