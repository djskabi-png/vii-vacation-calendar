import type { D1Database } from "../../types/cloudflare-runtime";

// Fixed schema/count projection. No caller-selected tables, SQL or row bodies.
export const METADATA_TABLES = Object.freeze([
  "supplier_catalog_runs", "supplier_catalog_entries", "supplier_catalog_state",
  "vii_content_items", "vii_content_versions", "vii_search_page_content",
  "vii_search_page_versions", "vii_search_page_publications",
  "vii_geography_nodes", "vii_geography_versions", "vii_redirects",
  "vii_search_page_opportunities", "vii_search_page_opportunity_versions",
] as const);

export const CATALOG_METADATA_SQL = `
SELECT 'totals' AS kind, '' AS world,
  json_object('runs', (SELECT COUNT(*) FROM supplier_catalog_runs),
    'entries', (SELECT COUNT(*) FROM supplier_catalog_entries),
    'states', (SELECT COUNT(*) FROM supplier_catalog_state)) AS data
UNION ALL
SELECT 'state' AS kind, s.world,
  json_object('activeRunId', s.active_run_id, 'activeCount', s.active_count,
    'acceptedAt', s.accepted_at, 'locked', CASE WHEN s.lock_run_id IS NULL THEN 0 ELSE 1 END,
    'activeRows', (SELECT COUNT(*) FROM supplier_catalog_entries e
      WHERE e.run_id = s.active_run_id AND e.world = s.world),
    'activeRunWorld', (SELECT r.world FROM supplier_catalog_runs r WHERE r.id = s.active_run_id),
    'activeRunStatus', (SELECT r.status FROM supplier_catalog_runs r WHERE r.id = s.active_run_id)) AS data
FROM supplier_catalog_state s
ORDER BY kind, world`;

const worlds = new Set(["vacations", "events", "rooms", "spa"]);
const headers = {
  "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff", Vary: "Cookie",
};

function boundedString(value: unknown, limit = 160): value is string {
  return typeof value === "string" && value.length <= limit;
}
function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export async function readBackendSourceMetadata(db: D1Database) {
  const catalog = await db.prepare(CATALOG_METADATA_SQL).all<{ kind: string; world: string; data: string }>();
  if (!catalog.success || !Array.isArray(catalog.results) || catalog.results.length > 5) throw new Error("invalid_metadata");
  const totals = catalog.results.filter(row => row.kind === "totals");
  if (totals.length !== 1 || !boundedString(totals[0].data, 1000)) throw new Error("invalid_metadata");
  const rawTotals = JSON.parse(totals[0].data) as Record<string, unknown>;
  if (![rawTotals.runs, rawTotals.entries, rawTotals.states].every(count)) throw new Error("invalid_metadata");
  const seen = new Set<string>();
  const states = catalog.results.filter(row => row.kind === "state").map(row => {
    if (!worlds.has(row.world) || seen.has(row.world) || !boundedString(row.data, 2000)) throw new Error("invalid_metadata");
    seen.add(row.world);
    const value = JSON.parse(row.data) as Record<string, unknown>;
    if (!(value.activeRunId === null || boundedString(value.activeRunId)) ||
      !(value.acceptedAt === null || boundedString(value.acceptedAt, 64)) ||
      !(value.activeRunWorld === null || worlds.has(String(value.activeRunWorld))) ||
      !(value.activeRunStatus === null || ["requested", "running", "accepted", "rejected", "failed", "skipped"].includes(String(value.activeRunStatus))) ||
      !count(value.activeCount) || !count(value.activeRows) || ![0, 1].includes(value.locked as number)) throw new Error("invalid_metadata");
    if (value.activeRunId === null && (value.activeRunWorld !== null || value.activeRunStatus !== null)) throw new Error("invalid_metadata");
    // Explicitly project response fields, never spread a database result.
    return { world: row.world, activeRunId: value.activeRunId, acceptedAt: value.acceptedAt,
      activeCount: value.activeCount, activeRows: value.activeRows, locked: value.locked === 1,
      generationMatches: value.activeRunId === null
        ? value.activeCount === 0 && value.activeRows === 0
        : value.activeRunWorld === row.world && value.activeRunStatus === "accepted" && value.activeCount === value.activeRows };
  });
  if (states.length !== rawTotals.states || catalog.results.length !== states.length + 1) throw new Error("invalid_metadata");

  const schemas = await db.batch(METADATA_TABLES.map(table => db.prepare(`PRAGMA table_info("${table}")`)));
  if (schemas.length !== METADATA_TABLES.length) throw new Error("invalid_metadata");
  const tables = schemas.map((result, index) => {
    if (!result.success || !Array.isArray(result.results) || result.results.length > 64) throw new Error("invalid_metadata");
    const columns = result.results.map(raw => {
      const row = raw as Record<string, unknown>;
      if (!boundedString(row.name, 64) || !boundedString(row.type, 64) || ![0, 1].includes(row.notnull as number) || !count(row.pk)) throw new Error("invalid_metadata");
      return { name: row.name, type: row.type, nullable: row.notnull === 0, primaryKeyOrder: row.pk };
    });
    return { table: METADATA_TABLES[index], exists: columns.length > 0, columns };
  });
  // Fixed counts only, no row bodies or actors. Never initialize missing tables.
  const countTables = tables.filter(table => table.exists && !table.table.startsWith("supplier_catalog_"));
  const countResults = countTables.length ? await db.batch(countTables.map(table => db.prepare(`SELECT COUNT(*) AS count FROM "${table.table}"`))) : [];
  if (countResults.length !== countTables.length) throw new Error("invalid_metadata");
  const rowCounts = new Map<string, number>();
  countResults.forEach((result, index) => {
    if (!result.success || !Array.isArray(result.results) || result.results.length !== 1) throw new Error("invalid_metadata");
    const value = (result.results[0] as Record<string, unknown>).count;
    if (!count(value)) throw new Error("invalid_metadata");
    rowCounts.set(countTables[index].table, value);
  });
  rowCounts.set("supplier_catalog_runs", rawTotals.runs as number);
  rowCounts.set("supplier_catalog_entries", rawTotals.entries as number);
  rowCounts.set("supplier_catalog_state", rawTotals.states as number);
  return {
    schemaVersion: 1, totals: { runs: rawTotals.runs, entries: rawTotals.entries, states: rawTotals.states }, states,
    tables: tables.map(table => ({ ...table, rowCount: rowCounts.get(table.table) ?? null })),
    observation: { catalogMetadataStatements: 1, schemasObservedSeparately: true, rowCountsObservedSeparately: true, rowBodiesIncluded: false },
    fullExport: false, sourceSnapshotVerified: false, migrationVerified: false, fullLaunchReady: false,
  };
}

type Dependencies = { authorized: (request: Request) => Promise<boolean>; database: () => Promise<D1Database> };
export async function backendSourceMetadataResponse(request: Request, dependencies: Dependencies) {
  const authorized = await dependencies.authorized(request).catch(() => false);
  if (!authorized) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.method !== "GET") return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { ...headers, Allow: "GET" } });
  const url = new URL(request.url), origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (url.search) return Response.json({ error: "invalid_request" }, { status: 400, headers });
  try {
    const metadata = await readBackendSourceMetadata(await dependencies.database());
    return Response.json(metadata, { headers });
  } catch {
    return Response.json({ error: "source_metadata_unavailable" }, { status: 503, headers });
  }
}
