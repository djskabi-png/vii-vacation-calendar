import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { businessAnalyticsDatabase } from "../../../lib/business-analytics.ts";
import { operationsDatabase } from "../../../lib/operations-audit.ts";
import { conversionTarget, fetchViiConversions, ViiConversionsError } from "../../../lib/vii-conversions.ts";
import { supplierToken } from "../../../lib/vii-supplier-token.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const nextDay = (value: string) => { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString(); };

export async function GET(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  const url = new URL(request.url);
  if (url.searchParams.get("mode") === "conversions") {
    const target = conversionTarget(url.searchParams.get("placeId") || "", url.searchParams.get("world") || "");
    const from = url.searchParams.get("from") || "";
    const till = url.searchParams.get("till") || "";
    if (!target) return Response.json({ error: "conversion_not_supported" }, { status: 400, headers });
    try {
      const conversions = await fetchViiConversions({ ...target, from, till, token: await supplierToken(), sectionOnly: true });
      return Response.json({ conversions }, { headers });
    } catch (error) {
      if (error instanceof ViiConversionsError) {
        const status = error.code === "invalid_request" ? 400 : error.code === "not_supported" ? 404 : 503;
        console.warn("vii_conversions_failed", { code: error.code, upstreamStatus: error.status, world: target.world, siteID: target.siteID });
        return Response.json({ error: error.code, upstreamStatus: error.status }, { status, headers });
      }
      return Response.json({ error: "supplier_unavailable" }, { status: 503, headers });
    }
  }

  const from = url.searchParams.get("from") || "";
  const till = url.searchParams.get("till") || "";
  const basis = url.searchParams.get("basis") === "arrival" ? "arrival" : "created";
  if (!validDay(from) || !validDay(till) || Date.parse(from) > Date.parse(till) || (Date.parse(till) - Date.parse(from)) / 86_400_000 > 365) {
    return Response.json({ error: "invalid_period" }, { status: 400, headers });
  }
  const since = `${from}T00:00:00.000Z`;
  const until = nextDay(till);
  try {
    const analyticsDb = await businessAnalyticsDatabase();
    const operationsDb = await operationsDatabase();
    const analytics = basis === "created" ? await analyticsDb.prepare(`SELECT place_id AS placeId, MAX(place_name) AS placeName, world,
      SUM(CASE WHEN name = 'impression' THEN 1 ELSE 0 END) AS impressions,
      SUM(CASE WHEN name = 'page_view' THEN 1 ELSE 0 END) AS pageViews,
      SUM(CASE WHEN name = 'phone_reveal' THEN 1 ELSE 0 END) AS phoneReveals,
      SUM(CASE WHEN name = 'phone_click' THEN 1 ELSE 0 END) AS phoneClicks,
      SUM(CASE WHEN name = 'whatsapp_lead' THEN 1 ELSE 0 END) AS whatsappLeads,
      SUM(CASE WHEN name = 'whatsapp_handoff' THEN 1 ELSE 0 END) AS whatsappHandoffs,
      SUM(CASE WHEN name = 'booking_request' THEN 1 ELSE 0 END) AS bookingRequests,
      COUNT(DISTINCT session_id) AS uniqueBrowsers
      FROM vii_business_events WHERE created_at >= ? AND created_at < ? AND internal = 0
      GROUP BY place_id, world ORDER BY pageViews DESC, impressions DESC LIMIT 500`).bind(since, until).all<Record<string, unknown>>() : { results: [] as Record<string, unknown>[] };
    const bookings = basis === "arrival"
      ? await operationsDb.prepare(`SELECT a.place_id AS placeId, MAX(a.place_name) AS placeName, a.world, COUNT(*) AS viiBookings
          FROM vii_booking_audit a JOIN vii_booking_context c ON c.id = a.id
          WHERE c.arrival_date >= ? AND c.arrival_date <= ? GROUP BY a.place_id, a.world`).bind(from, till).all<Record<string, unknown>>()
      : await operationsDb.prepare(`SELECT place_id AS placeId, MAX(place_name) AS placeName, world, COUNT(*) AS viiBookings
          FROM vii_booking_audit WHERE created_at >= ? AND created_at < ? GROUP BY place_id, world`).bind(since, until).all<Record<string, unknown>>();
    const reviews = basis === "created" ? await operationsDb.prepare(`SELECT subject_id AS placeId, COUNT(*) AS reviews
      FROM guest_reviews WHERE created_at >= ? AND created_at < ? GROUP BY subject_id`).bind(since, until).all<{ placeId: string; reviews: number }>() : { results: [] as { placeId: string; reviews: number }[] };
    const rows = new Map<string, Record<string, unknown>>();
    const base = { impressions: 0, pageViews: 0, phoneReveals: 0, phoneClicks: 0, whatsappLeads: 0, whatsappHandoffs: 0, bookingRequests: 0, uniqueBrowsers: 0, viiBookings: 0, reviews: 0 };
    for (const row of analytics.results) rows.set(`${row.world}:${row.placeId}`, { ...base, ...row });
    for (const row of bookings.results) { const key = `${row.world}:${row.placeId}`; rows.set(key, { ...base, ...(rows.get(key) || {}), ...row }); }
    const reviewMap = new Map(reviews.results.map((row) => [row.placeId, Number(row.reviews || 0)]));
    for (const row of rows.values()) row.reviews = reviewMap.get(String(row.placeId)) || 0;
    return Response.json({ basis, from, till, rows: [...rows.values()] }, { headers });
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
  const body = await request.json().catch(() => null) as { from?: unknown; till?: unknown; targets?: unknown } | null;
  const from = typeof body?.from === "string" ? body.from : "";
  const till = typeof body?.till === "string" ? body.till : "";
  if (!validDay(from) || !validDay(till) || Date.parse(from) > Date.parse(till) || (Date.parse(till) - Date.parse(from)) / 86_400_000 > 365 || !Array.isArray(body?.targets) || body.targets.length > 4) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  }
  const targets = (body.targets as BatchTarget[]).flatMap((row) => {
    if (!row || typeof row.placeId !== "string" || typeof row.world !== "string") return [];
    const target = conversionTarget(row.placeId, row.world);
    return target ? [{ placeId: row.placeId, world: row.world, target }] : [];
  });
  if (targets.length !== body.targets.length) return Response.json({ error: "conversion_not_supported" }, { status: 400, headers });
  const token = await supplierToken().catch(() => "");
  if (!token) return Response.json({ error: "supplier_unavailable" }, { status: 503, headers });
  const results: Array<{ placeId: string; conversions?: Awaited<ReturnType<typeof fetchViiConversions>>; error?: string }> = [];
  const settled = await Promise.all(targets.map(async ({ placeId, target }) => {
      try {
        return { placeId, conversions: await fetchViiConversions({ ...target, from, till, token, sectionOnly: true }) };
      } catch (error) {
        return { placeId, error: error instanceof ViiConversionsError ? error.code : "supplier_unavailable" };
      }
    }));
  results.push(...settled);
  return Response.json({ from, till, results }, { headers });
}
