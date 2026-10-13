import { readSession } from "../../../lib/google-auth.ts";
import { parseSearchEvent, saveSearchEvent, searchAnalyticsDatabase } from "../../../lib/search-analytics.ts";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin) return Response.json({ error: "invalid_origin" }, { status: 403 });
  if (Number(request.headers.get("content-length") || "0") > 1024) return Response.json({ error: "too_large" }, { status: 413 });
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 1024) return Response.json({ error: "too_large" }, { status: 413 });
    input = JSON.parse(body);
  } catch { return Response.json({ error: "invalid_input" }, { status: 400 }); }
  const event = parseSearchEvent(input);
  if (!event) return Response.json({ error: "invalid_input" }, { status: 400 });
  const userAgent = request.headers.get("user-agent") || "";
  if (/bot|crawler|spider|headless/i.test(userAgent)) return new Response(null, { status: 204 });
  const session = await readSession(request).catch(() => null);
  const admins = (process.env.VII_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase());
  try {
    await saveSearchEvent(await searchAnalyticsDatabase(), event, !!session && admins.includes(session.email.toLowerCase()));
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("VII search analytics save unavailable", error);
    return Response.json({ error: "search_analytics_unavailable" }, { status: 503 });
  }
}

