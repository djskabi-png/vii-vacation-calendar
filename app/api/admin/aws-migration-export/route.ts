import { createHash, timingSafeEqual } from "node:crypto";
import type { D1Database } from "../../../../types/cloudflare-runtime";

export const dynamic = "force-dynamic";

const TABLES = [
  "discovery_promotion_draft_events", "guest_review_files", "guest_reviews",
  "supplier_catalog_alerts", "supplier_catalog_entries", "supplier_catalog_retry_jobs",
  "supplier_catalog_runs", "supplier_catalog_state", "vii_admin_grant_audit",
  "vii_admin_grants", "vii_booking_audit", "vii_booking_rate", "vii_business_events",
  "vii_content_items", "vii_content_versions", "vii_discovery_offer_cache_v1",
  "vii_geography_nodes", "vii_geography_versions", "vii_redirect_events", "vii_redirects",
  "vii_search_demand_events", "vii_search_events", "vii_search_page_content",
  "vii_search_page_opportunities", "vii_search_page_opportunity_versions",
  "vii_search_page_publications", "vii_search_page_versions", "whatsapp_leads",
] as const;

function secureEqual(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: {
    "cache-control": "private, no-store, max-age=0",
    "x-robots-tag": "noindex, nofollow, noarchive",
  } });
}

export async function GET(request: Request) {
  const runtime = await import("cloudflare:workers");
  const env = runtime.env as unknown as { DB?: D1Database; VII_MIGRATION_EXPORT_TOKEN?: string };
  const expected = env.VII_MIGRATION_EXPORT_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied || !secureEqual(supplied, expected)) return response({ ok: false, error: "not_found" }, 404);
  if (!env.DB) return response({ ok: false, error: "database_unavailable" }, 503);

  const url = new URL(request.url);
  const table = url.searchParams.get("table");
  if (!table) {
    const manifest = [];
    for (const name of TABLES) {
      const [count, columns, indexes, foreignKeys, definitions] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).first<{ count: number }>(),
        env.DB.prepare(`PRAGMA table_xinfo("${name}")`).all(),
        env.DB.prepare(`PRAGMA index_list("${name}")`).all(),
        env.DB.prepare(`PRAGMA foreign_key_list("${name}")`).all(),
        env.DB.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE tbl_name = ? ORDER BY type, name").bind(name).all(),
      ]);
      const indexDetails = [];
      for (const index of indexes.results as Array<{ name?: string }>) {
        if (!index.name) continue;
        const detail = await env.DB.prepare(`PRAGMA index_xinfo("${index.name.replaceAll('"', '""')}")`).all();
        indexDetails.push({ ...index, columns: detail.results });
      }
      manifest.push({
        name,
        count: Number(count?.count || 0),
        columns: columns.results,
        indexes: indexDetails,
        foreignKeys: foreignKeys.results,
        definitions: definitions.results,
      });
    }
    return response({ ok: true, version: 1, tables: manifest });
  }

  if (!(TABLES as readonly string[]).includes(table)) return response({ ok: false, error: "unknown_table" }, 400);
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0);
  const limit = Math.min(250, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "100", 10) || 100));
  const columns = await env.DB.prepare(`PRAGMA table_xinfo("${table}")`).all<{ name: string; pk: number }>();
  const primaryKey = columns.results
    .filter(column => Number(column.pk) > 0)
    .sort((left, right) => Number(left.pk) - Number(right.pk))
    .map(column => `"${String(column.name).replaceAll('"', '""')}"`);
  const orderBy = primaryKey.length > 0 ? primaryKey.join(", ") : "rowid";
  const rows = await env.DB.prepare(`SELECT * FROM "${table}" ORDER BY ${orderBy} LIMIT ? OFFSET ?`).bind(limit, offset).all();
  return response({ ok: true, table, offset, limit, rows: rows.results });
}
