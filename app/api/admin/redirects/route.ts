import { readSession } from "../../../lib/google-auth.ts";
import { parseRedirectInput, redirectsDatabase, type RedirectRecord } from "../../../lib/admin-redirects.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

async function admin(request: Request) {
  const session = await readSession(request).catch(() => null);
  const allowed = (process.env.VII_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase());
  return session && allowed.includes(session.email.toLowerCase()) ? session.email : null;
}

export async function GET(request: Request) {
  if (!await admin(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const db = await redirectsDatabase();
    const list = await db.prepare("SELECT source_path, target_path, status, active, updated_at, updated_by FROM vii_redirects ORDER BY updated_at DESC LIMIT 500").all<RedirectRecord>();
    return Response.json({ redirects: list.results, truncated: list.results.length === 500 }, { headers });
  } catch (error) {
    console.error("VII redirect list unavailable", error);
    return Response.json({ error: "redirects_unavailable" }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  const actor = await admin(request);
  if (!actor) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  let input: unknown;
  try { const body = await request.text(); if (body.length > 2000) return Response.json({ error: "too_large" }, { status: 413, headers }); input = JSON.parse(body); }
  catch { return Response.json({ error: "invalid_input" }, { status: 400, headers }); }
  const change = parseRedirectInput(input);
  if (!change) return Response.json({ error: "invalid_redirect" }, { status: 400, headers });
  try {
    const db = await redirectsDatabase();
    if (change.active && change.status === 301) {
      const targetPath = change.targetPath?.split("?")[0].replace(/\/$/, "") || "/";
      const [forward, incoming] = await Promise.all([
        db.prepare("SELECT source_path FROM vii_redirects WHERE source_path = ? AND active = 1").bind(targetPath).first(),
        db.prepare("SELECT source_path FROM vii_redirects WHERE target_path = ? AND active = 1 AND status = 301 LIMIT 1").bind(change.sourcePath).first(),
      ]);
      if (forward || incoming) return Response.json({ error: "redirect_chain" }, { status: 409, headers });
    }
    const previous = await db.prepare("SELECT source_path, target_path, status, active, updated_at, updated_by FROM vii_redirects WHERE source_path = ?").bind(change.sourcePath).first<RedirectRecord>();
    const now = new Date().toISOString();
    const next: RedirectRecord = { source_path: change.sourcePath, target_path: change.targetPath, status: change.status, active: change.active ? 1 : 0, updated_at: now, updated_by: actor };
    await db.batch([
      db.prepare(`INSERT INTO vii_redirects (source_path, target_path, status, active, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(source_path) DO UPDATE SET target_path = excluded.target_path, status = excluded.status, active = excluded.active, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(next.source_path, next.target_path, next.status, next.active, next.updated_at, next.updated_by),
      db.prepare("INSERT INTO vii_redirect_events (id, source_path, old_value, new_value, at, actor) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), change.sourcePath, previous ? JSON.stringify(previous) : null, JSON.stringify(next), now, actor),
    ]);
    return Response.json({ redirect: next }, { headers });
  } catch (error) {
    console.error("VII redirect save unavailable", error);
    return Response.json({ error: "redirects_unavailable" }, { status: 503, headers });
  }
}
