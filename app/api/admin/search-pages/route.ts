import { readSession } from "../../../lib/google-auth.ts";
import { isAdminEmail } from "../../../lib/admin-access.ts";
import { opportunityDatabase, parseOpportunityChange, readOpportunity, readOpportunityDashboard, saveOpportunity } from "../../../lib/search-opportunities.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

async function admin(request: Request) {
  const session = await readSession(request).catch(() => null);
  return session && isAdminEmail(session.email) ? session.email : null;
}

export async function GET(request: Request) {
  if (!await admin(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") || 30);
  if (![7, 30, 90].includes(days)) return Response.json({ error: "invalid_period" }, { status: 400, headers });
  try {
    const database = await opportunityDatabase();
    const id = url.searchParams.get("id");
    if (id) {
      const result = await readOpportunity(database, id);
      return result ? Response.json(result, { headers }) : Response.json({ error: "not_found" }, { status: 404, headers });
    }
    return Response.json(await readOpportunityDashboard(database, days), { headers });
  } catch (error) {
    console.error("VII search opportunity inventory unavailable", error);
    return Response.json({ error: "search_pages_unavailable" }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  const actor = await admin(request);
  if (!actor) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 20_000) return Response.json({ error: "too_large" }, { status: 413, headers });
    input = JSON.parse(body);
  } catch { return Response.json({ error: "invalid_input" }, { status: 400, headers }); }
  const change = parseOpportunityChange(input);
  if (!change) return Response.json({ error: "invalid_page" }, { status: 400, headers });
  try {
    const result = await saveOpportunity(await opportunityDatabase(), change, actor);
    if ("error" in result) return Response.json({ error: result.error }, { status: result.error === "not_found" ? 404 : result.error === "invalid_identity" || result.error === "indexing_required" ? 400 : 409, headers });
    return Response.json(result, { headers });
  } catch (error) {
    console.error("VII search opportunity save unavailable", error);
    return Response.json({ error: "search_pages_unavailable" }, { status: 503, headers });
  }
}
