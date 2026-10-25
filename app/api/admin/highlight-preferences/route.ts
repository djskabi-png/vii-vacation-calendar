import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { readAdminHighlightPreferences, saveAdminHighlightPreferences } from "../../../lib/admin-highlight-preferences.ts";
import { requiredRuntimeDatabase } from "../../../lib/runtime-database.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

async function context(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) return null;
  return { session, db: await requiredRuntimeDatabase("admin_highlight_preferences_unavailable") };
}

export async function GET(request: Request) {
  const active = await context(request);
  if (!active) return Response.json({ error: "forbidden" }, { status: 403, headers });
  return Response.json(await readAdminHighlightPreferences(active.db, active.session.email), { headers });
}

export async function PUT(request: Request) {
  const active = await context(request);
  if (!active) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  const raw = await request.text();
  if (raw.length > 10_000) return Response.json({ error: "too_large" }, { status: 413, headers });
  let body: unknown;
  try { body = JSON.parse(raw || "{}"); } catch { body = null; }
  const input = body && typeof body === "object" ? body as { order?: unknown; expanded?: unknown } : null;
  if (!input) return Response.json({ error: "invalid_input" }, { status: 400, headers });
  return Response.json(await saveAdminHighlightPreferences(active.db, active.session.email, input), { headers });
}
