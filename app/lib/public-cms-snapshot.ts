import type { D1Database } from "../../types/cloudflare-runtime";
import { CMS_MAX_BYTES, CMS_MAX_ROWS, PUBLIC_CMS_SNAPSHOT_SQL, validatePublicCmsProjection, type PublicCmsRow } from "./public-cms-source.ts";
import { snapshotChain } from "./catalog-snapshot.ts";

export const CMS_SNAPSHOT_SEED = "vii-public-cms-snapshot-v1";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff", Vary: "Cookie" };
const encoder = new TextEncoder();
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;

export async function publicCmsSnapshot(db: D1Database) {
  // Capture one scheduling boundary for every family in the same SQL snapshot.
  const observedAt = new Date().toISOString();
  const result = await db.prepare(PUBLIC_CMS_SNAPSHOT_SQL).bind(observedAt).all<PublicCmsRow>();
  if (!result.success || !Array.isArray(result.results) || result.results.length > CMS_MAX_ROWS + 1) throw Error("cms_snapshot_unavailable");
  const controls = result.results.filter(row => row.family === "control");
  if (controls.length !== 1 || controls[0].identity !== "" || typeof controls[0].data !== "string" || controls[0].data.length > 1000) throw Error("cms_snapshot_unavailable");
  const control = JSON.parse(controls[0].data);
  if (control.ok !== 1 || !integer(control.rowCount) || !integer(control.rawBytes) || control.rawBytes > CMS_MAX_BYTES || control.rowCount !== result.results.length - 1) throw Error("cms_snapshot_unavailable");
  const projection = validatePublicCmsProjection(result.results.filter(row => row.family !== "control"), observedAt);
  const manifest = { type: "manifest", format: CMS_SNAPSHOT_SEED,
    scope: "published-cms-configuration-visible-geography-active-redirects",
    consistency: "one-read-only-sql-statement", observedAt, counts: projection.counts,
    rawBytes: control.rawBytes, hashAlgorithm: "sha256-chain-v1",
    payloadClassification: "published-text-and-configuration-may-contain-personal-data",
    excluded: ["draft-and-future-content", "administrative-identity-and-analytics-columns", "history",
      "static-code-fallbacks", "catalog-generations", "media-binaries", "users-auth-bookings-leads-messages"],
    fullDatabaseExport: false, stageUploadAuthorized: false, sourceSnapshotVerified: false,
    targetReadVerified: false, migrationVerified: false, fullLaunchReady: false };
  let position = -1, chain = CMS_SNAPSHOT_SEED;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (position === projection.records.length) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "complete", rows: position, sha256: chain }) + "\n"));
        controller.close(); return;
      }
      const value = position < 0 ? manifest : { type: "record", ...projection.records[position] };
      const line = JSON.stringify(value) + "\n";
      chain = await snapshotChain(chain, line);
      controller.enqueue(encoder.encode(line)); position++;
    },
  });
}

type Dependencies = { authorized: (request: Request) => Promise<boolean>; database: () => Promise<D1Database> };
export async function publicCmsSnapshotResponse(request: Request, dependencies: Dependencies) {
  if (!await dependencies.authorized(request).catch(() => false)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.method !== "GET") return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { ...headers, Allow: "GET" } });
  const url = new URL(request.url), origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (url.search) return Response.json({ error: "invalid_request" }, { status: 400, headers });
  try {
    return new Response(await publicCmsSnapshot(await dependencies.database()), { headers: { ...headers,
      "Content-Type": "application/x-ndjson; charset=utf-8", "Content-Disposition": 'attachment; filename="vii-public-cms.ndjson"' } });
  } catch {
    return Response.json({ error: "cms_snapshot_unavailable" }, { status: 503, headers });
  }
}
