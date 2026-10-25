import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { readSearchAnalytics, searchAnalyticsDatabase } from "../../../lib/search-analytics.ts";
import { cachedAdminReport } from "../../../lib/admin-report-cache.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403, headers });
  }
  const days = Number(new URL(request.url).searchParams.get("days") || 7);
  if (![1, 7, 30].includes(days)) return Response.json({ error: "invalid_period" }, { status: 400, headers });
  try {
    const db = await searchAnalyticsDatabase();
    const report = await cachedAdminReport({ db, family: "search-analytics", parameters: { days }, freshForMs: 5 * 60_000,
      forceRefresh: new URL(request.url).searchParams.get("refresh") === "1", loader: () => readSearchAnalytics(db, days) });
    return Response.json({ ...report.value, reportCache: report.cache }, { headers });
  }
  catch (error) {
    console.error("VII search analytics report unavailable", error);
    // This endpoint is restricted to an authenticated administrator. Keep a
    // bounded diagnostic with the failed report so production schema drift can
    // be identified without exposing stack traces or credentials publicly.
    const detail = error instanceof Error ? error.message.slice(0, 240) : "unknown_error";
    return Response.json({ error: "search_analytics_unavailable", detail }, { status: 503, headers });
  }
}
