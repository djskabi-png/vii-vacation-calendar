import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { normalizeRedirectSource, parseRedirectInput, redirectsDatabase, shouldCheckRedirect, type RedirectRecord } from "../../../lib/admin-redirects.ts";
import { bundledRedirectRecord, mergedRedirectInventory } from "../../../lib/redirect-admin-inventory.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

async function admin(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  return session ? session.email : null;
}

export async function GET(request: Request) {
  if (!await admin(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 100);
    const query = (url.searchParams.get("q") || "").slice(0, 200);
    const status = url.searchParams.get("status") || "all";
    const state = url.searchParams.get("state") || "all";
    const origin = url.searchParams.get("origin") || "all";
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 20 || pageSize > 200
      || !/^(all|301|410)$/.test(status) || !/^(all|active|draft)$/.test(state) || !/^(all|legacy|managed)$/.test(origin)) {
      return Response.json({ error: "invalid_request" }, { status: 400, headers });
    }
    const db = await redirectsDatabase();
    const list = await db.prepare("SELECT source_path, target_path, status, active, deleted, updated_at, updated_by FROM vii_redirects ORDER BY source_path").all<RedirectRecord>();
    const inventory = mergedRedirectInventory(list.results, { page, pageSize, query,
      status: status as "all" | "301" | "410", state: state as "all" | "active" | "draft",
      origin: origin as "all" | "legacy" | "managed" });
    const { rows, ...metadata } = inventory;
    return Response.json({ redirects: rows, ...metadata }, { headers });
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
        db.prepare("SELECT source_path FROM vii_redirects WHERE source_path = ? AND active = 1 AND deleted = 0").bind(targetPath).first(),
        db.prepare("SELECT source_path FROM vii_redirects WHERE target_path = ? AND active = 1 AND deleted = 0 AND status = 301 LIMIT 1").bind(change.sourcePath).first(),
      ]);
      if (forward || incoming) return Response.json({ error: "redirect_chain" }, { status: 409, headers });
    }
    const previous = await db.prepare("SELECT source_path, target_path, status, active, deleted, updated_at, updated_by FROM vii_redirects WHERE source_path = ?").bind(change.sourcePath).first<RedirectRecord>();
    const now = new Date().toISOString();
    const next: RedirectRecord = { source_path: change.sourcePath, target_path: change.targetPath, status: change.status, active: change.active ? 1 : 0, deleted: 0, updated_at: now, updated_by: actor };
    await db.batch([
      db.prepare(`INSERT INTO vii_redirects (source_path, target_path, status, active, deleted, updated_at, updated_by) VALUES (?, ?, ?, ?, 0, ?, ?) ON CONFLICT(source_path) DO UPDATE SET target_path = excluded.target_path, status = excluded.status, active = excluded.active, deleted = 0, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(next.source_path, next.target_path, next.status, next.active, next.updated_at, next.updated_by),
      db.prepare("INSERT INTO vii_redirect_events (id, source_path, old_value, new_value, at, actor) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), change.sourcePath, previous ? JSON.stringify(previous) : null, JSON.stringify(next), now, actor),
    ]);
    return Response.json({ redirect: next }, { headers });
  } catch (error) {
    console.error("VII redirect save unavailable", error);
    return Response.json({ error: "redirects_unavailable" }, { status: 503, headers });
  }
}

export async function DELETE(request: Request) {
  const actor = await admin(request);
  if (!actor) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  let sourceInput = "";
  try {
    const body = await request.text();
    if (body.length > 600) return Response.json({ error: "too_large" }, { status: 413, headers });
    const parsed = JSON.parse(body) as { sourcePath?: unknown };
    sourceInput = typeof parsed.sourcePath === "string" ? parsed.sourcePath : "";
  } catch { return Response.json({ error: "invalid_input" }, { status: 400, headers }); }
  if (!sourceInput || sourceInput.length > 400 || !sourceInput.startsWith("/")) return Response.json({ error: "invalid_input" }, { status: 400, headers });
  const sourcePath = normalizeRedirectSource(sourceInput);
  if (!shouldCheckRedirect(sourcePath.split("?")[0])) return Response.json({ error: "invalid_redirect" }, { status: 400, headers });
  try {
    const db = await redirectsDatabase();
    const previous = await db.prepare("SELECT source_path, target_path, status, active, deleted, updated_at, updated_by FROM vii_redirects WHERE source_path = ?")
      .bind(sourcePath).first<RedirectRecord>();
    const baseline = bundledRedirectRecord(sourcePath);
    if ((!previous || previous.deleted) && !baseline) return Response.json({ error: "not_found" }, { status: 404, headers });
    const now = new Date().toISOString();
    const current = previous && !previous.deleted ? previous : baseline!;
    const tombstone: RedirectRecord = { source_path: sourcePath, target_path: null, status: current.status,
      active: 0, deleted: 1, updated_at: now, updated_by: actor };
    await db.batch([
      db.prepare(`INSERT INTO vii_redirects (source_path, target_path, status, active, deleted, updated_at, updated_by)
        VALUES (?, NULL, ?, 0, 1, ?, ?)
        ON CONFLICT(source_path) DO UPDATE SET target_path = NULL, status = excluded.status, active = 0,
          deleted = 1, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
        .bind(sourcePath, current.status, now, actor),
      db.prepare("INSERT INTO vii_redirect_events (id, source_path, old_value, new_value, at, actor) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), sourcePath, JSON.stringify(current), JSON.stringify(tombstone), now, actor),
    ]);
    return Response.json({ deleted: true, sourcePath }, { headers });
  } catch (error) {
    console.error("VII redirect delete unavailable", error);
    return Response.json({ error: "redirects_unavailable" }, { status: 503, headers });
  }
}
