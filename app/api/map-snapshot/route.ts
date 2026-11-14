import type { D1Database, R2Bucket } from "../../../types/cloudflare-runtime";
import { getRequestExecutionContext } from "vinext/shims/request-context";
import { cloudflareDatabaseForEnv } from "../../lib/runtime-database";
import { bundledMapSnapshotCandidates } from "../../lib/map-snapshot-catalog";
import { readMapSnapshot, reconcileMapSnapshots, type MapSnapshotProviderEnvironment } from "../../lib/map-snapshot-store";

const allowedWorlds = new Set(["vacation", "events", "spa", "hourly", "activities"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const world = (url.searchParams.get("world") || "").trim().toLowerCase();
  const placeId = (url.searchParams.get("id") || "").trim();
  const probe = url.searchParams.get("probe") === "1";
  if (!allowedWorlds.has(world) || !/^[a-z0-9_-]{1,160}$/i.test(placeId)) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });

  try {
    const runtimeName = "cloudflare:workers";
    const runtime = await import(/* @vite-ignore */ runtimeName);
    const env = runtime.env as unknown as { DB?: D1Database; UPLOADS?: R2Bucket; VII_AWS_DB_ENDPOINT?: string; VII_AWS_DB_TOKEN?: string; VII_AWS_DB_MODE?: string } & MapSnapshotProviderEnvironment;
    const db = cloudflareDatabaseForEnv(env);
    if (!db || !env.UPLOADS) throw new Error("map_snapshot_storage_unavailable");
    const record = await readMapSnapshot(db, world, placeId);
    if (!record?.objectKey) {
      const candidate = bundledMapSnapshotCandidates().find((item) => item.world === world && item.placeId === placeId);
      const context = getRequestExecutionContext();
      if (candidate && context) context.waitUntil(reconcileMapSnapshots({ db, bucket: env.UPLOADS, env, candidates: [candidate], limit: 1 }).catch(() => undefined));
      return new Response(null, { status: 204, headers: { "Cache-Control": "public, max-age=30, s-maxage=60", "X-VII-Map-Snapshot": candidate ? "warming" : "missing" } });
    }
    if (probe) {
      const object = await env.UPLOADS.head(record.objectKey);
      return new Response(null, { status: 204, headers: { "Cache-Control": "public, max-age=300, s-maxage=900", "X-VII-Map-Snapshot": object ? "ready" : "missing" } });
    }
    const object = await env.UPLOADS.get(record.objectKey);
    if (!object) return new Response(null, { status: 204, headers: { "Cache-Control": "public, max-age=60, s-maxage=300", "X-VII-Map-Snapshot": "missing" } });
    const headers = new Headers({ "Content-Type": record.contentType || object.httpMetadata?.contentType || "image/webp" });
    headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");
    headers.set("ETag", object.httpEtag);
    headers.set("X-VII-Map-Snapshot", record.status);
    if (record.attribution) headers.set("X-VII-Map-Attribution", record.attribution);
    return new Response(object.body as unknown as BodyInit, { headers });
  } catch {
    return new Response(null, { status: 204, headers: { "Cache-Control": "public, max-age=30", "X-VII-Map-Snapshot": "unavailable" } });
  }
}
