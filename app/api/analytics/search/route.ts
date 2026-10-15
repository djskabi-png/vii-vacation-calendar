import { readSession } from "../../../lib/google-auth.ts";
import { isAdminEmail } from "../../../lib/admin-access.ts";
import { parseSearchDemandEvent, saveSearchEvent, searchAnalyticsDatabase } from "../../../lib/search-analytics.ts";

const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

async function administrator(request: Request) {
  const session = await readSession(request).catch(() => null);
  return !!session && isAdminEmail(session.email);
}

export async function GET(request: Request) {
  return new Response(null, { status: await administrator(request) ? 204 : 403, headers: noStore });
}

export function searchCaptureMode(value: unknown, isAdministrator: boolean) {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (row.adminTestOnly === true) return isAdministrator ? "internal" : "discard";
  if (row.consentState === "denied_or_unset") return "discard";
  return isAdministrator ? "internal" : "public";
}

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
  const event = parseSearchDemandEvent(input);
  if (!event) return Response.json({ error: "invalid_input" }, { status: 400 });
  const userAgent = request.headers.get("user-agent") || "";
  if (/bot|crawler|spider|headless/i.test(userAgent)) return new Response(null, { status: 204 });
  const mode = searchCaptureMode(input, await administrator(request));
  if (mode === "discard") return new Response(null, { status: 204, headers: noStore });
  try {
    await saveSearchEvent(await searchAnalyticsDatabase(), event, mode === "internal");
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("VII search analytics save unavailable", error);
    return Response.json({ error: "search_analytics_unavailable" }, { status: 503 });
  }
}
