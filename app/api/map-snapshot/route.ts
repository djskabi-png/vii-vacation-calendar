import type { D1Database, R2Bucket } from "../../../types/cloudflare-runtime";
import { databaseForRuntimeEnv } from "../../lib/aws-database";
import { readMapSnapshot } from "../../lib/map-snapshot-store";

const allowedWorlds = new Set(["vacation", "events", "spa", "hourly", "activities"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const world = (url.searchParams.get("world") || "").trim().toLowerCase();
  const placeId = (url.searchParams.get("id") || "").trim();
  if (!allowedWorlds.has(world) || !/^[a-z0-9_-]{1,160}$/i.test(placeId)) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });

  try {
    const runtimeName = "cloudflare:workers";
    const runtime = await import(/* @vite-ignore */ runtimeName);
    const env = runtime.env as unknown as { DB?: D1Database; UPLOADS?: R2Bucket; VII_AWS_DB_ENDPOINT?: string; VII_AWS_DB_TOKEN?: string; VII_AWS_DB_MODE?: string };
    const db = databaseForRuntimeEnv(env);
    if (!db || !env.UPLOADS) throw new Error("map_snapshot_storage_unavailable");
    const record = await readMapSnapshot(db, world, placeId);
    if (!record?.objectKey) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
    const object = await env.UPLOADS.get(record.objectKey);
    if (!object) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
    const headers = new Headers({ "Content-Type": record.contentType || object.httpMetadata?.contentType || "image/webp" });
    headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");
    headers.set("ETag", object.httpEtag);
    headers.set("X-VII-Map-Snapshot", record.status);
    if (record.attribution) headers.set("X-VII-Map-Attribution", record.attribution);
    return new Response(object.body as unknown as BodyInit, { headers });
  } catch {
    return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=30" } });
  }
}
