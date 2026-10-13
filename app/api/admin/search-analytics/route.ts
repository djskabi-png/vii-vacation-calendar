import { readSession } from "../../../lib/google-auth.ts";
import { readSearchAnalytics, searchAnalyticsDatabase } from "../../../lib/search-analytics.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  const admins = (process.env.VII_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const session = await readSession(request).catch(() => null);
  if (!session || !admins.includes(session.email.toLowerCase())) {
    return Response.json({ error: "forbidden" }, { status: 403, headers });
  }
  const days = Number(new URL(request.url).searchParams.get("days") || 7);
  if (![1, 7, 30].includes(days)) return Response.json({ error: "invalid_period" }, { status: 400, headers });
  try { return Response.json(await readSearchAnalytics(await searchAnalyticsDatabase(), days), { headers }); }
  catch (error) {
    console.error("VII search analytics report unavailable", error);
    return Response.json({ error: "search_analytics_unavailable" }, { status: 503, headers });
  }
}

