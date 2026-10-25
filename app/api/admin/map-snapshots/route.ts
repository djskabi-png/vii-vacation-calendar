import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { databaseForRuntimeEnv } from "../../../lib/aws-database.ts";
import { bundledMapSnapshotCandidates } from "../../../lib/map-snapshot-catalog.ts";
import { readMapSnapshotDashboard, reconcileMapSnapshots, type MapSnapshotProviderEnvironment } from "../../../lib/map-snapshot-store.ts";
import type { D1Database, R2Bucket } from "../../../../types/cloudflare-runtime";

const headers = { "Cache-Control": "no-store" };

async function authorized(request: Request) {
  try { return Boolean(await authorizedAdminSession(request)); } catch { return false; }
}

async function runtime() {
  const moduleName = "cloudflare:workers";
  const runtimeModule = await import(/* @vite-ignore */ moduleName);
  const env = runtimeModule.env as unknown as { DB?: D1Database; UPLOADS?: R2Bucket } & MapSnapshotProviderEnvironment;
  const db = databaseForRuntimeEnv(env);
  if (!db || !env.UPLOADS) throw new Error("map_snapshot_storage_unavailable");
  return { db, bucket: env.UPLOADS, env };
}

export async function GET(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const { db, env } = await runtime();
    return Response.json({ ...(await readMapSnapshotDashboard(db)), providerConfigured: Boolean(env.VII_MAPBOX_STATIC_TOKEN || env.VII_MAPTILER_API_KEY) }, { headers });
  } catch (error) {
    console.error("VII map snapshot dashboard unavailable", error);
    return Response.json({ error: "map_snapshot_dashboard_unavailable" }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  try {
    const { db, bucket, env } = await runtime();
    const result = await reconcileMapSnapshots({ db, bucket, env, candidates: bundledMapSnapshotCandidates(), limit: 10, force: true });
    return Response.json({ result, dashboard: await readMapSnapshotDashboard(db) }, { status: result.providerConfigured ? 200 : 409, headers });
  } catch (error) {
    console.error("VII map snapshot reconciliation unavailable", error);
    return Response.json({ error: "map_snapshot_reconciliation_unavailable" }, { status: 503, headers });
  }
}
