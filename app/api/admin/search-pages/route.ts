import { readSession } from "../../../lib/google-auth.ts";
import { parseSearchPageInput, searchPageDatabase, searchPageDefinition, searchPageInventory } from "../../../lib/search-page-content.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

async function admin(request: Request) {
  const session = await readSession(request).catch(() => null);
  const allowed = (process.env.VII_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase());
  return session && allowed.includes(session.email.toLowerCase()) ? session.email : null;
}

export async function GET(request: Request) {
  if (!await admin(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const database = await searchPageDatabase();
    const historyPath = new URL(request.url).searchParams.get("history");
    if (historyPath !== null) {
      if (!searchPageDefinition(historyPath)) return Response.json({ error: "invalid_page" }, { status: 400, headers });
      const history = await database.prepare("SELECT title, description, status, version, updated_at AS updatedAt, updated_by AS updatedBy FROM vii_search_page_versions WHERE path = ? ORDER BY version DESC LIMIT 20").bind(historyPath).all();
      return Response.json({ history: history.results }, { headers });
    }
    return Response.json({ pages: await searchPageInventory(database) }, { headers });
  }
  catch (error) { console.error("VII search page inventory unavailable", error); return Response.json({ error: "search_pages_unavailable" }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  const actor = await admin(request);
  if (!actor) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  let input: unknown;
  try { const body = await request.text(); if (body.length > 2000) return Response.json({ error: "too_large" }, { status: 413, headers }); input = JSON.parse(body); }
  catch { return Response.json({ error: "invalid_input" }, { status: 400, headers }); }
  const change = parseSearchPageInput(input);
  if (!change) return Response.json({ error: "invalid_page" }, { status: 400, headers });
  try {
    const database = await searchPageDatabase();
    const prior = await database.prepare("SELECT version FROM vii_search_page_content WHERE path = ?").bind(change.path).first<{ version: number }>();
    if ((prior?.version || 0) !== change.expectedVersion) return Response.json({ error: "version_conflict" }, { status: 409, headers });
    const version = (prior?.version || 0) + 1;
    const at = new Date().toISOString();
    await database.batch([
      database.prepare(`INSERT INTO vii_search_page_content (path, title, description, status, version, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET title = excluded.title, description = excluded.description, status = excluded.status, version = excluded.version, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(change.path, change.title, change.description, change.status, version, at, actor),
      database.prepare("INSERT INTO vii_search_page_versions (id, path, title, description, status, version, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), change.path, change.title, change.description, change.status, version, at, actor),
    ]);
    return Response.json({ page: { ...change, version, updatedAt: at, updatedBy: actor } }, { headers });
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) return Response.json({ error: "version_conflict" }, { status: 409, headers });
    console.error("VII search page save unavailable", error);
    return Response.json({ error: "search_pages_unavailable" }, { status: 503, headers });
  }
}

