import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { conversionTarget, fetchViiConversions, ViiConversionsError, type ConversionWorld } from "../../../lib/vii-conversions.ts";
import { supplierToken } from "../../../lib/vii-supplier-token.ts";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { bizConversionDatabase, cachedBizConversions, loadCachedBizConversions, loadCachedBizConversionFailures,
  readCachedBizConversionFailure, saveBizConversionFailure } from "../../../lib/biz-conversion-cache.ts";
import { readBizReportRuns, startBizReportRun, stopBizReportRun, updateBizReportRun } from "../../../lib/biz-report-runs.ts";
import { cachedAdminReport } from "../../../lib/admin-report-cache.ts";
import { mergeBusinessPerformanceRows } from "../../../lib/business-performance-rows.ts";
import { reportingDatabase } from "../../../lib/runtime-database.ts";
import { isClosedReportPeriod } from "../../../lib/report-date-policy.ts";
import { getRequestExecutionContext } from "vinext/shims/request-context";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const nextDay = (value: string) => { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString(); };

type InventoryPlace = { supplierId?: number; id?: string; name?: string; title?: string };

async function reportingRows<T>(operation: Promise<{ results: T[] }>, degraded: boolean, source: string) {
  try {
    return await operation;
  } catch (error) {
    if (!degraded) throw error;
    console.warn("reporting_d1_source_unavailable", {
      source,
      reason: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    return { results: [] as T[] };
  }
}

function uniqueConversionRows<T extends { placeId: unknown; world: unknown }>(rows: T[]) {
  const unique = new Map<number, T>();
  const priority = (world: ConversionWorld) => world === "vacations" ? 0 : world === "events" ? 1 : 2;
  for (const row of rows) {
    const target = conversionTarget(String(row.placeId), String(row.world));
    if (!target) continue;
    const current = unique.get(target.siteID);
    const currentTarget = current ? conversionTarget(String(current.placeId), String(current.world)) : null;
    if (!current || !currentTarget || priority(target.world) < priority(currentTarget.world)) unique.set(target.siteID, row);
  }
  return [...unique.values()];
}

async function supportedInventory() {
  const [vacations, events, rooms, spa] = await Promise.all([
    publicCatalogSummaries<InventoryPlace>("vacations"),
    publicCatalogSummaries<InventoryPlace>("events"),
    publicCatalogSummaries<InventoryPlace>("rooms"),
    publicCatalogSummaries<InventoryPlace>("spa"),
  ]);
  return [
    ...vacations.flatMap((place) => Number.isSafeInteger(place.supplierId) && Number(place.supplierId) > 0 ? [{ placeId: `vacation-${place.supplierId}`, placeName: place.name || `נופש ${place.supplierId}`, world: "vacations" }] : []),
    ...events.flatMap((place) => Number.isSafeInteger(place.supplierId) && Number(place.supplierId) > 0 ? [{ placeId: `event-${place.supplierId}`, placeName: place.name || `אירוע ${place.supplierId}`, world: "events" }] : []),
    ...rooms.flatMap((place) => {
      const supplierId = Number(place.supplierId || (typeof place.id === "string" ? place.id.match(/\d+$/)?.[0] : 0));
      return Number.isSafeInteger(supplierId) && supplierId > 0 ? [{ placeId: `hourly-${supplierId}`, placeName: place.name || place.title || `חדר ${supplierId}`, world: "rooms" }] : [];
    }),
    ...spa.flatMap((place) => {
      const supplierId = Number(place.supplierId || place.id);
      return Number.isSafeInteger(supplierId) && supplierId > 0 ? [{ placeId: `spa-${supplierId}`, placeName: place.title || place.name || `ספא ${supplierId}`, world: "spa" }] : [];
    }),
  ];
}

export async function GET(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  const url = new URL(request.url);
  if (url.searchParams.get("mode") === "run-history") {
    try {
      const reporting = await reportingDatabase();
      const database = await bizConversionDatabase(reporting.database);
      return Response.json({ runHistory: await readBizReportRuns(database, 20),
        databaseOrigin: reporting.origin, degraded: reporting.degraded }, { headers });
    } catch {
      return Response.json({ error: "biz_report_history_unavailable" }, { status: 503, headers });
    }
  }
  if (url.searchParams.get("mode") === "conversions") {
    const target = conversionTarget(url.searchParams.get("placeId") || "", url.searchParams.get("world") || "");
    const from = url.searchParams.get("from") || "";
    const till = url.searchParams.get("till") || "";
    if (!target) return Response.json({ error: "conversion_not_supported" }, { status: 400, headers });
    const source = url.searchParams.get("source");
    const converted = url.searchParams.get("converted");
    const includeContacts = url.searchParams.get("details") === "1";
    if (!validDay(from) || !validDay(till) || Date.parse(from) > Date.parse(till) || (Date.parse(till) - Date.parse(from)) / 86_400_000 > 365) {
      return Response.json({ error: "invalid_period" }, { status: 400, headers });
    }
    if (source !== null && source !== "whatsapp" && source !== "maskyoo" && source !== "form") return Response.json({ error: "invalid_request" }, { status: 400, headers });
    if (converted !== null && converted !== "yes" && converted !== "no") return Response.json({ error: "invalid_request" }, { status: 400, headers });
    try {
      const reporting = await reportingDatabase();
      const database = await bizConversionDatabase(reporting.database);
      const historical = isClosedReportPeriod(till);
      const report = await cachedAdminReport({ db: database, family: "business-conversions", parameters: {
        world: target.world, siteID: target.siteID, from, till, source: source || "all", converted: converted || "all", includeContacts,
      }, freshForMs: historical ? 7 * 86400_000 : 2 * 60_000,
      deferRefresh: (operation) => getRequestExecutionContext()?.waitUntil(operation),
      forceRefresh: url.searchParams.get("refresh") === "1",
      loader: async () => fetchViiConversions({ ...target, from, till, token: await supplierToken(),
        source: source || undefined, converted: converted || undefined, includeContacts }) });
      return Response.json({ conversions: report.value, reportCache: report.cache,
        databaseOrigin: reporting.origin, degraded: reporting.degraded }, { headers });
    } catch (error) {
      if (error instanceof ViiConversionsError) {
        const status = error.code === "invalid_request" ? 400 : error.code === "not_supported" ? 404 : 503;
        console.warn("vii_conversions_failed", { code: error.code, upstreamStatus: error.status, world: target.world, siteID: target.siteID });
        return Response.json({ error: error.code, upstreamStatus: error.status, diagnostic: error.diagnostic }, { status, headers });
      }
      return Response.json({ error: "supplier_unavailable" }, { status: 503, headers });
    }
  }

  const from = url.searchParams.get("from") || "";
  const till = url.searchParams.get("till") || "";
  const basis = url.searchParams.get("basis") === "arrival" ? "arrival" : "created";
  const forceRefresh = url.searchParams.get("refresh") === "1";
  if (!validDay(from) || !validDay(till) || Date.parse(from) > Date.parse(till) || (Date.parse(till) - Date.parse(from)) / 86_400_000 > 365) {
    return Response.json({ error: "invalid_period" }, { status: 400, headers });
  }
  const since = `${from}T00:00:00.000Z`;
  const until = nextDay(till);
  try {
    const reporting = await reportingDatabase();
    let cacheReady = true;
    const cacheDb = await bizConversionDatabase(reporting.database).catch((error) => {
      if (!reporting.degraded) throw error;
      cacheReady = false;
      console.warn("biz_conversion_cache_schema_unavailable", {
        reason: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      });
      return reporting.database;
    });
    const historical = isClosedReportPeriod(till);
    const report = await cachedAdminReport({ db: cacheDb, family: "business-performance", parameters: { from, till, basis },
      freshForMs: historical ? 365 * 86400_000 : 2 * 60_000, immutable: historical, forceRefresh, loader: async () => {
    const analyticsDb = cacheDb;
    const operationsDb = cacheDb;
    const inventory = await supportedInventory();
    const analytics = basis === "created" ? await reportingRows(analyticsDb.prepare(`SELECT place_id AS placeId, MAX(place_name) AS placeName, world,
      SUM(CASE WHEN name = 'impression' THEN 1 ELSE 0 END) AS impressions,
      SUM(CASE WHEN name = 'page_view' THEN 1 ELSE 0 END) AS pageViews,
      SUM(CASE WHEN name = 'phone_reveal' THEN 1 ELSE 0 END) AS phoneReveals,
      SUM(CASE WHEN name = 'phone_click' THEN 1 ELSE 0 END) AS phoneClicks,
      SUM(CASE WHEN name = 'whatsapp_lead' THEN 1 ELSE 0 END) AS whatsappLeads,
      SUM(CASE WHEN name = 'whatsapp_handoff' THEN 1 ELSE 0 END) AS whatsappHandoffs,
      SUM(CASE WHEN name = 'booking_request' THEN 1 ELSE 0 END) AS bookingRequests,
      COUNT(DISTINCT session_id) AS uniqueBrowsers
      FROM vii_business_events WHERE created_at >= ? AND created_at < ? AND internal = 0
      GROUP BY place_id, world
      ORDER BY pageViews DESC, impressions DESC LIMIT 500`).bind(since, until).all<Record<string, unknown>>(), reporting.degraded, "vii_business_events")
      : { results: [] as Record<string, unknown>[] };
    const bookings = basis === "arrival"
      ? await reportingRows(operationsDb.prepare(`SELECT a.place_id AS placeId, MAX(a.place_name) AS placeName, a.world, COUNT(*) AS viiBookings
          FROM vii_booking_audit a JOIN vii_booking_context c ON c.id = a.id
          WHERE c.arrival_date >= ? AND c.arrival_date <= ? GROUP BY a.place_id, a.world`).bind(from, till).all<Record<string, unknown>>(), reporting.degraded, "vii_booking_arrivals")
      : await reportingRows(operationsDb.prepare(`SELECT place_id AS placeId, MAX(place_name) AS placeName, world, COUNT(*) AS viiBookings
          FROM vii_booking_audit WHERE created_at >= ? AND created_at < ? GROUP BY place_id, world`).bind(since, until).all<Record<string, unknown>>(),
        reporting.degraded, "vii_booking_audit");
    const reviews = basis === "created" ? await reportingRows(operationsDb.prepare(`SELECT subject_id AS placeId, COUNT(*) AS reviews
      FROM guest_reviews WHERE created_at >= ? AND created_at < ? GROUP BY subject_id`).bind(since, until).all<{ placeId: string; reviews: number }>(),
      reporting.degraded, "guest_reviews") : { results: [] as { placeId: string; reviews: number }[] };
    const rows = mergeBusinessPerformanceRows(inventory, analytics.results, bookings.results);
    const reviewMap = new Map(reviews.results.map((row) => [row.placeId, Number(row.reviews || 0)]));
    for (const row of rows) row.reviews = reviewMap.get(String(row.placeId)) || 0;
    return { rows };
    }});
    const database = await bizConversionDatabase(cacheDb).catch((error) => {
      console.warn("biz_conversion_cache_unavailable", { error: error instanceof Error ? error.name : "unknown" });
      return null;
    });
    const [cached, cachedFailures, runHistory] = await Promise.all([
      database ? loadCachedBizConversions(database, from, till).catch((error) => {
        console.warn("biz_conversion_cache_read_failed", { error: error instanceof Error ? error.name : "unknown" });
        return [];
      }) : Promise.resolve([]),
      database ? loadCachedBizConversionFailures(database, from, till).catch((error) => {
        console.warn("biz_conversion_failure_cache_read_failed", { error: error instanceof Error ? error.name : "unknown" });
        return [];
      }) : Promise.resolve([]),
      database ? readBizReportRuns(database, 20).catch((error) => {
        console.warn("biz_report_history_read_failed", { error: error instanceof Error ? error.name : "unknown" });
        return [];
      }) : Promise.resolve([]),
    ]);
    const failureSnapshots = Object.fromEntries(cachedFailures.map((item) => {
      const prefix = item.world === "vacations" ? "vacation" : item.world === "events" ? "event" : "hourly";
      return [`${prefix}-${item.siteID}`, { error: item.error, cache: item.cache }];
    }));
    const successSnapshots = Object.fromEntries(cached.map((item) => {
      const prefix = item.world === "vacations" ? "vacation" : item.world === "events" ? "event" : "hourly";
      return [`${prefix}-${item.siteID}`, { summary: item.conversions.summary, clicks: item.conversions.clicks, cache: item.cache }];
    }));
    const supportedRows = uniqueConversionRows(report.value.rows as Array<Record<string, unknown> & { placeId: unknown; world: unknown }>);
    const completedRun = runHistory.find((run) => run.from === from && run.till === till && run.scope === "all"
      && run.status === "completed" && run.processed === run.total && run.total === supportedRows.length);
    const inferredFailures = completedRun ? Object.fromEntries(supportedRows.flatMap((row) => {
      const placeId = String(row.placeId);
      if (successSnapshots[placeId] || failureSnapshots[placeId]) return [];
      const savedAt = completedRun.updatedAt;
      const retryAt = new Date(Date.parse(savedAt) + 6 * 60 * 60_000).toISOString();
      return [[placeId, { error: "previous_run_failed", cache: { status: "failure_cached", savedAt, retryAt,
        stale: Date.parse(retryAt) <= Date.now() } }]];
    })) : {};
    const bizSnapshots = { ...inferredFailures, ...failureSnapshots, ...successSnapshots };
    return Response.json({ basis, from, till, rows: report.value.rows, reportCache: report.cache, bizSnapshots, runHistory,
      databaseOrigin: reporting.origin, degraded: reporting.degraded, cacheReady }, { headers });
  } catch (error) {
    console.error("business_performance_unavailable", error);
    return Response.json({ error: "business_performance_unavailable" }, { status: 503, headers });
  }
}

type BatchTarget = { placeId: string; world: string };

export async function POST(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  const body = await request.json().catch(() => null) as { action?: unknown; jobId?: unknown; from?: unknown; till?: unknown;
    scope?: unknown; total?: unknown; processedBefore?: unknown; succeededBefore?: unknown; unsupportedBefore?: unknown; failedBefore?: unknown;
    targets?: unknown; forceRefresh?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  const validJobId = /^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(jobId);
  if (body?.action === "stop") {
    if (!validJobId) return Response.json({ error: "invalid_request" }, { status: 400, headers });
    const reporting = await reportingDatabase().catch(() => null);
    const cacheDb = reporting ? await bizConversionDatabase(reporting.database).catch(() => null) : null;
    if (!cacheDb) return Response.json({ error: "biz_conversion_cache_unavailable" }, { status: 503, headers });
    await stopBizReportRun(cacheDb, jobId, session.email);
    return Response.json({ ok: true }, { headers });
  }
  const from = typeof body?.from === "string" ? body.from : "";
  const till = typeof body?.till === "string" ? body.till : "";
  const scope = typeof body?.scope === "string" ? body.scope : "all";
  const total = Number(body?.total);
  const processedBefore = Number(body?.processedBefore);
  const succeededBefore = Number(body?.succeededBefore);
  const unsupportedBefore = Number(body?.unsupportedBefore);
  const failedBefore = Number(body?.failedBefore);
  if (!validJobId || !validDay(from) || !validDay(till) || Date.parse(from) > Date.parse(till) || (Date.parse(till) - Date.parse(from)) / 86_400_000 > 365
    || !/^(all|vacations|events|rooms)$/.test(scope) || !Number.isSafeInteger(total) || total < 1 || total > 5000
    || !Number.isSafeInteger(processedBefore) || processedBefore < 0 || !Number.isSafeInteger(succeededBefore) || succeededBefore < 0
    || !Number.isSafeInteger(unsupportedBefore) || unsupportedBefore < 0 || !Number.isSafeInteger(failedBefore) || failedBefore < 0
    || succeededBefore + unsupportedBefore + failedBefore !== processedBefore
    || !Array.isArray(body?.targets) || body.targets.length < 1 || body.targets.length > 12 || processedBefore + body.targets.length > total
    || (body?.forceRefresh !== undefined && typeof body.forceRefresh !== "boolean")) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  }
  const requestedTargets = (body.targets as BatchTarget[]).flatMap((row) => {
    if (!row || typeof row.placeId !== "string" || typeof row.world !== "string") return [];
    const target = conversionTarget(row.placeId, row.world);
    return target ? [{ placeId: row.placeId, world: row.world, target }] : [];
  });
  if (requestedTargets.length !== body.targets.length) return Response.json({ error: "conversion_not_supported" }, { status: 400, headers });
  const targets = uniqueConversionRows(requestedTargets);
  const token = await supplierToken().catch(() => "");
  const reporting = await reportingDatabase().catch(() => null);
  const cacheDb = reporting ? await bizConversionDatabase(reporting.database).catch(() => null) : null;
  if (!cacheDb) return Response.json({ error: "biz_conversion_cache_unavailable" }, { status: 503, headers });
  await startBizReportRun(cacheDb, { jobId, actorEmail: session.email, from, till, scope,
    forceRefresh: body.forceRefresh === true, total });
  const results: Array<{ placeId: string; conversions?: Awaited<ReturnType<typeof fetchViiConversions>>; error?: string }> = [];
  const settled = await Promise.all(targets.map(async ({ placeId, target }) => {
      try {
        if (body.forceRefresh !== true) {
          const failure = await readCachedBizConversionFailure(cacheDb, target.world, target.siteID, from, till);
          if (failure && !failure.cache.stale) return { placeId, error: failure.error, cache: failure.cache };
        }
        const result = await cachedBizConversions({ db: cacheDb, ...target, from, till, forceRefresh: body.forceRefresh === true,
          deferRefresh: (operation) => getRequestExecutionContext()?.waitUntil(operation),
          fetcher: () => fetchViiConversions({ ...target, from, till, token, includeContacts: true }) });
        return { placeId, conversions: result.conversions, cache: result.cache };
      } catch (error) {
        const code = error instanceof ViiConversionsError ? error.code : "supplier_unavailable";
        const failure = await saveBizConversionFailure(cacheDb, { ...target, from, till, error: code });
        return { placeId, error: code, cache: failure.cache };
      }
    }));
  results.push(...settled);
  const unsupportedInBatch = settled.filter((item) => item.error === "not_supported").length;
  const failedInBatch = settled.filter((item) => item.error && item.error !== "not_supported").length;
  const processed = processedBefore + settled.length;
  const succeeded = succeededBefore + settled.length - unsupportedInBatch - failedInBatch;
  const unsupported = unsupportedBefore + unsupportedInBatch;
  const failed = failedBefore + failedInBatch;
  const status = processed >= total ? "completed" : "running";
  await updateBizReportRun(cacheDb, { jobId, actorEmail: session.email, processed, succeeded, unsupported, failed, status });
  return Response.json({ from, till, results, run: { jobId, processed, succeeded, unsupported, failed, total, status },
    databaseOrigin: reporting?.origin, degraded: reporting?.degraded ?? false }, { headers });
}
