import type { D1Database } from "../../types/cloudflare-runtime";

export const SNAPSHOT_MAX_BYTES = 12 * 1024 * 1024;
export const SNAPSHOT_MAX_ROWS = 5008;
export const SNAPSHOT_SEED = "vii-active-catalog-snapshot-v1";
// One SQL statement is the snapshot boundary. No pagination, session bookmark
// approximation, SELECT *, schema initialization, or caller-controlled SQL.
export const CATALOG_SNAPSHOT_SQL = `WITH
states AS (SELECT world,active_run_id,accepted_at,active_count,lock_run_id,lock_until FROM supplier_catalog_state),
active_runs AS (SELECT r.id,r.world,r.source,r.status,r.started_at,r.finished_at,r.before_count,
  r.candidate_count,r.added_count,r.changed_count,r.removed_count,r.error_code,r.diagnostics_json FROM supplier_catalog_runs r
  JOIN states s ON s.active_run_id=r.id),
rows AS (
  SELECT 'run' AS kind, r.id AS key, r.world AS world,
    json_object('id',r.id,'world',r.world,'source',r.source,'status',r.status,
      'startedAt',r.started_at,'finishedAt',r.finished_at,'beforeCount',r.before_count,
      'candidateCount',r.candidate_count,'addedCount',r.added_count,
      'changedCount',r.changed_count,'removedCount',r.removed_count,
      'errorCode',r.error_code,'diagnosticsJson',r.diagnostics_json) AS data,
    NULL AS summary, NULL AS detail FROM active_runs r
  UNION ALL SELECT 'entry',e.id,e.world,json_object('id',e.id,'runId',e.run_id,'world',e.world,'supplierId',e.supplier_id),e.summary_json,e.detail_json
    FROM supplier_catalog_entries e JOIN states s ON s.active_run_id=e.run_id
  UNION ALL SELECT 'state',s.world,s.world,
    json_object('world',s.world,'activeRunId',s.active_run_id,'acceptedAt',s.accepted_at,
      'activeCount',s.active_count,'lockRunId',s.lock_run_id,'lockUntil',s.lock_until),
    NULL,NULL FROM states s
),
measure AS (SELECT COUNT(*) AS row_count,
  COALESCE(SUM(length(CAST(COALESCE(data,'') AS BLOB))+
    length(CAST(COALESCE(summary,'') AS BLOB))+length(CAST(COALESCE(detail,'') AS BLOB))+
    length(CAST(key AS BLOB))+length(CAST(world AS BLOB))+128),0) AS bytes,
  COALESCE(MAX(length(CAST(COALESCE(data,'') AS BLOB))+
    length(CAST(COALESCE(summary,'') AS BLOB))+length(CAST(COALESCE(detail,'') AS BLOB))+128),0) AS row_bytes
  FROM rows),
guard AS (SELECT CASE WHEN
  (SELECT COUNT(*) FROM states)=4 AND (SELECT COUNT(*) FROM active_runs)=4
  AND NOT EXISTS(SELECT 1 FROM states s LEFT JOIN active_runs r ON r.id=s.active_run_id
    WHERE s.world NOT IN ('vacations','events','rooms','spa')
      OR s.active_run_id IS NULL OR s.accepted_at IS NULL
      OR s.lock_run_id IS NOT NULL OR s.lock_until IS NOT NULL
      OR s.active_count < 1 OR s.active_count IS NULL
      OR r.id IS NULL OR r.world<>s.world OR r.status<>'accepted' OR r.finished_at IS NULL
      OR s.active_count<>(SELECT COUNT(*) FROM supplier_catalog_entries e WHERE e.run_id=s.active_run_id))
  AND NOT EXISTS(SELECT 1 FROM supplier_catalog_entries e JOIN states s ON s.active_run_id=e.run_id
    WHERE e.world<>s.world OR e.world IS NULL OR e.supplier_id<1 OR e.supplier_id IS NULL
      OR e.summary_json IS NULL)
  AND measure.row_count<=${SNAPSHOT_MAX_ROWS} AND measure.bytes<=${SNAPSHOT_MAX_BYTES}
  AND measure.row_bytes<=1900000 THEN 1 ELSE 0 END AS ok,
  measure.row_count, measure.bytes FROM measure)
SELECT 'control' AS kind, '' AS key, '' AS world,
  json_object('ok',ok,'rowCount',row_count,'rawBytes',bytes) AS data,
  NULL AS summary,NULL AS detail FROM guard
UNION ALL SELECT kind,key,world,data,summary,detail FROM rows WHERE (SELECT ok FROM guard)=1
ORDER BY kind,key`;

type SnapshotRow = { kind: string; key: string; world: string; data: string | null; summary: string | null; detail: string | null };
const worlds = new Set(["vacations", "events", "rooms", "spa"]);
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff", Vary: "Cookie" };
const encoder = new TextEncoder();
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;

export async function snapshotChain(previous: string, line: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(previous + "\n" + line));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function activeCatalogSnapshot(db: D1Database) {
  const result = await db.prepare(CATALOG_SNAPSHOT_SQL).all<SnapshotRow>();
  if (!result.success || !Array.isArray(result.results) || result.results.length > SNAPSHOT_MAX_ROWS + 1) throw new Error("snapshot_unavailable");
  const controls = result.results.filter(r => r.kind === "control");
  if (controls.length !== 1 || typeof controls[0].data !== "string" || controls[0].data.length > 1000) throw new Error("snapshot_unavailable");
  const control = JSON.parse(controls[0].data);
  if (control.ok !== 1 || !integer(control.rowCount) || !integer(control.rawBytes) ||
    control.rowCount !== result.results.length - 1 || control.rawBytes > SNAPSHOT_MAX_BYTES) throw new Error("snapshot_unavailable");
  const rows = result.results.filter(r => r.kind !== "control");
  const counts = { run: 0, entry: 0, state: 0 };
  const seen = new Set<string>();
  for (const row of rows) {
    if (!["run", "entry", "state"].includes(row.kind) || !worlds.has(row.world) ||
      typeof row.key !== "string" || !row.key || row.key.length > 300 || seen.has(row.kind + ":" + row.key) ||
      typeof row.data !== "string" || row.data.length > 1_900_000 ||
      (row.summary !== null && typeof row.summary !== "string") || (row.detail !== null && typeof row.detail !== "string")) throw new Error("snapshot_unavailable");
    seen.add(row.kind + ":" + row.key);
    const value = JSON.parse(row.data);
    if (!value || value.world !== row.world || (row.kind === "state" ? value.world : value.id) !== row.key) throw new Error("snapshot_unavailable");
    if (row.kind === "entry") {
      if (typeof row.summary !== "string" || !row.summary || !Number.isSafeInteger(value.supplierId) || value.supplierId <= 0 || typeof value.runId !== "string") throw new Error("snapshot_unavailable");
      for (const payload of [row.summary, row.detail]) if (payload !== null) JSON.parse(payload);
    } else if (row.summary !== null || row.detail !== null) throw new Error("snapshot_unavailable");
    counts[row.kind as keyof typeof counts]++;
  }
  if (counts.run !== 4 || counts.state !== 4 || counts.entry < 4) throw new Error("snapshot_unavailable");
  const manifest = { type: "manifest", format: SNAPSHOT_SEED, scope: "four-active-catalog-generations",
    consistency: "one-read-only-sql-statement", counts, rawBytes: control.rawBytes,
    hashAlgorithm: "sha256-chain-v1", payloadClassification: "raw-supplier-data-may-contain-personal-data",
    excluded: ["historical-generations", "CMS-and-drafts", "media-files", "users-auth-bookings-leads-and-messages"],
    fullDatabaseExport: false, migrationVerified: false, targetReadVerified: false, fullLaunchReady: false };
  let position = -1, chain = SNAPSHOT_SEED;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (position === rows.length) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "complete", rows: rows.length, sha256: chain }) + "\n"));
        controller.close();
        return;
      }
      const row = position < 0 ? manifest : { type: rows[position].kind, key: rows[position].key,
        world: rows[position].world, data: rows[position].data, summary: rows[position].summary, detail: rows[position].detail };
      const line = JSON.stringify(row) + "\n";
      chain = await snapshotChain(chain, line);
      controller.enqueue(encoder.encode(line));
      position++;
    },
  });
}

type Dependencies = { authorized: (request: Request) => Promise<boolean>; database: () => Promise<D1Database> };
export async function catalogSnapshotResponse(request: Request, dependencies: Dependencies) {
  if (!await dependencies.authorized(request).catch(() => false)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.method !== "GET") return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { ...headers, Allow: "GET" } });
  const url = new URL(request.url), origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (url.search) return Response.json({ error: "invalid_request" }, { status: 400, headers });
  try {
    const body = await activeCatalogSnapshot(await dependencies.database());
    return new Response(body, { headers: { ...headers, "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vii-active-catalog.ndjson"' } });
  } catch {
    return Response.json({ error: "catalog_snapshot_unavailable" }, { status: 503, headers });
  }
}
