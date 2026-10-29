import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { ensureRedirectSchema, normalizeRedirectSource, parseRedirectInput, shouldCheckRedirect } from "../app/lib/admin-redirects.ts";
import { DELETE, GET, POST } from "../app/api/admin/redirects/route.ts";
import { mergedRedirectInventory } from "../app/lib/redirect-admin-inventory.ts";

test("redirect editor rejects active routes, system paths and external targets", () => {
  const good = { sourcePath: "/legacy-villa-123", targetPath: "/villas/north", status: 301, active: true };
  assert.deepEqual(parseRedirectInput(good), good);
  for (const sourcePath of ["/admin", "/api/foo", "/search", "/spas/pool", "//external", "/x/../y"]) {
    assert.equal(parseRedirectInput({ ...good, sourcePath }), null, sourcePath);
  }
  for (const targetPath of ["https://evil.example", "//evil.example", "/admin", "/legacy-other", "/legacy-villa-123"]) {
    assert.equal(parseRedirectInput({ ...good, targetPath }), null, targetPath);
  }
  assert.equal(shouldCheckRedirect("/legacy-villa-123"), true);
  assert.equal(shouldCheckRedirect("/legacy-villa-123.html"), true);
  assert.equal(shouldCheckRedirect("/asset.png"), false);
  assert.equal(shouldCheckRedirect("/events/search/north"), false);
  assert.equal(normalizeRedirectSource("/s/?sett=508&attr=48"), "/s?attr=48&sett=508");
  assert.deepEqual(parseRedirectInput({ sourcePath: "/s/?sett=508&attr=48", targetPath: "/search?location=%D7%90%D7%99%D7%9C%D7%AA", status: 301, active: true }),
    { sourcePath: "/s?attr=48&sett=508", targetPath: "/search?location=%D7%90%D7%99%D7%9C%D7%AA", status: 301, active: true });
});

test("410 redirect has no target and can be saved as a draft", () => {
  assert.deepEqual(parseRedirectInput({ sourcePath: "/old-deleted", targetPath: "", status: 410, active: false }),
    { sourcePath: "/old-deleted", targetPath: null, status: 410, active: false });
});

test("redirect API denies anonymous reads and writes", async () => {
  const url = "https://vii.spaplus.co/api/admin/redirects";
  const get = await GET(new Request(url));
  assert.equal(get.status, 403);
  const post = await POST(new Request(url, { method: "POST", headers: { origin: "https://vii.spaplus.co", "Content-Type": "application/json" }, body: JSON.stringify({ sourcePath: "/old", targetPath: "/search", status: 301, active: true }) }));
  assert.equal(post.status, 403);
  const remove = await DELETE(new Request(url, { method: "DELETE", headers: { origin: "https://vii.spaplus.co", "Content-Type": "application/json" }, body: JSON.stringify({ sourcePath: "/villa_circle" }) }));
  assert.equal(remove.status, 403);
});

test("redirect administration merges the complete bundled inventory with managed precedence", () => {
  const baseline = mergedRedirectInventory([], { pageSize: 100 });
  assert.equal(baseline.allTotal, 3553);
  assert.equal(baseline.baselineTotal, 3553);
  assert.equal(baseline.rows.length, 100);
  const result = mergedRedirectInventory([
    { source_path: "/villa_circle", target_path: "/business?id=vacation-999", status: 301, active: 1, deleted: 0, updated_at: "2026-10-25T00:00:00.000Z", updated_by: "owner@example.test" },
    { source_path: "/villa_yotam", target_path: null, status: 301, active: 0, deleted: 1, updated_at: "2026-10-25T00:00:00.000Z", updated_by: "owner@example.test" },
  ], { query: "villa_circle", pageSize: 100 });
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].target_path, "/business?id=vacation-999");
  assert.equal(result.rows[0].origin, "managed");
  assert.equal(result.rows[0].bundled, true);
  const deleted = mergedRedirectInventory([
    { source_path: "/villa_yotam", target_path: null, status: 301, active: 0, deleted: 1, updated_at: "2026-10-25T00:00:00.000Z", updated_by: "owner@example.test" },
  ], { query: "villa_yotam", pageSize: 100 });
  assert.equal(deleted.total, 0);
  assert.equal(deleted.deleted, 1);
  assert.equal(deleted.allTotal, 3552);
});

test("redirect inventory filters outside the first page without rendering every row", () => {
  const result = mergedRedirectInventory([], { query: "zimmer_tropi", status: "301", origin: "legacy", pageSize: 20 });
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].source_path, "/zimmer_tropi");
  assert.equal(result.rows.length, 1);
});

test("a deleted managed tombstone suppresses the bundled Worker fallback", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /redirectRecordForUrl/);
  assert.match(worker, /managedOverride = Boolean\(managed\)/);
  assert.match(worker, /const legacy = managedOverride \? null : legacyDisposition\(url\)/);
  assert.match(worker, /!managed\.deleted && managed\.active/);
});

test("redirect administration exposes proof, filters, pagination and deletion", async () => {
  const page = await readFile(new URL("../app/admin/redirects/page.tsx", import.meta.url), "utf8");
  for (const expected of ["כל הכתובות וההפניות", "סה״כ במערכת", "מיפוי האתר הישן", "שונה במערכת", "מחיקה", "pageSize", "originFilter", "statusFilter"]) {
    assert.match(page, new RegExp(expected));
  }
  assert.match(page, /method: "DELETE"/);
  assert.match(page, /ההפניה נמחקה, תועדה ולא תחזור ממיפוי ישן נסתר/);
});

test("existing D1 redirect storage upgrades once and persists deletion tombstones", { timeout: 30000 }, async () => {
  const require = createRequire(import.meta.url);
  const dependency = createRequire(require.resolve("wrangler"));
  const { Miniflare } = dependency("miniflare");
  const mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('synthetic-only')}}",
    compatibilityDate: "2026-05-15", d1Databases: { DB: "synthetic-redirect-inventory" } });
  try {
    const db = await mf.getD1Database("DB");
    await db.prepare("CREATE TABLE vii_redirects (source_path TEXT PRIMARY KEY NOT NULL, target_path TEXT, status INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)").run();
    await ensureRedirectSchema(db); await ensureRedirectSchema(db);
    const columns = await db.prepare("PRAGMA table_info(vii_redirects)").all();
    assert.ok(columns.results.some((column) => column.name === "deleted"));
    await db.prepare("INSERT INTO vii_redirects (source_path,target_path,status,active,deleted,updated_at,updated_by) VALUES (?,NULL,301,0,1,?,?)")
      .bind("/villa_circle", new Date(0).toISOString(), "owner@example.test").run();
    const tombstone = await db.prepare("SELECT deleted, active, target_path FROM vii_redirects WHERE source_path=?").bind("/villa_circle").first();
    assert.deepEqual(tombstone, { deleted: 1, active: 0, target_path: null });
  } finally { await mf.dispose(); }
});
