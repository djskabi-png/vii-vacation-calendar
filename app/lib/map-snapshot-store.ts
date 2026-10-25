import type { D1Database, R2Bucket } from "../../types/cloudflare-runtime";
import type { MapSnapshotCandidate, MapSnapshotWorld } from "./map-snapshot-catalog";

export type MapSnapshotProviderEnvironment = {
  VII_STATIC_MAP_PROVIDER?: string;
  VII_MAPBOX_STATIC_TOKEN?: string;
  VII_MAPTILER_API_KEY?: string;
};

export type MapSnapshotStatus = "missing" | "processing" | "ready" | "failed" | "stale";

export type MapSnapshotRecord = {
  entityKey: string;
  world: MapSnapshotWorld;
  placeId: string;
  sourceHash: string;
  status: MapSnapshotStatus;
  objectKey: string | null;
  contentType: string | null;
  provider: string | null;
  attribution: string | null;
  generatedAt: string | null;
  checkedAt: string;
  lastError: string | null;
};

const SNAPSHOT_WIDTH = 1200;
const SNAPSHOT_HEIGHT = 600;
const LEASE_MS = 8 * 60_000;
const FAILURE_RETRY_MS = 24 * 60 * 60_000;
const MIN_IMAGE_BYTES = 8_000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function safeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "place";
}
function fingerprint(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function mapSnapshotSourceHash(candidate: MapSnapshotCandidate, provider: string) {
  return fingerprint([candidate.world, candidate.placeId, candidate.lat.toFixed(6), candidate.lng.toFixed(6), candidate.precision, candidate.zoom, provider, "v1"].join("|"));
}

export function mapSnapshotEntityKey(world: string, placeId: string) {
  return `${safeSegment(world)}:${safeSegment(placeId)}`;
}

export async function ensureMapSnapshotSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_map_snapshots_v1 (
    entity_key TEXT PRIMARY KEY NOT NULL,
    world TEXT NOT NULL,
    place_id TEXT NOT NULL,
    place_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    precision TEXT NOT NULL,
    zoom INTEGER NOT NULL,
    source_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'missing',
    object_key TEXT,
    content_type TEXT,
    byte_size INTEGER,
    width INTEGER,
    height INTEGER,
    provider TEXT,
    attribution TEXT,
    generated_at TEXT,
    checked_at TEXT NOT NULL,
    retry_after TEXT,
    lease_until TEXT,
    lease_token TEXT,
    last_error TEXT
  )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_map_snapshots_status_retry ON vii_map_snapshots_v1(status, retry_after)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_map_snapshots_world_place ON vii_map_snapshots_v1(world, place_id)"),
  ]);
}

type StaticMapRequest = { provider: "mapbox" | "maptiler"; url: string; attribution: string };

export function staticMapRequest(candidate: MapSnapshotCandidate, env: MapSnapshotProviderEnvironment): StaticMapRequest | null {
  const requested = (env.VII_STATIC_MAP_PROVIDER || "").trim().toLowerCase();
  if ((requested === "mapbox" || (!requested && env.VII_MAPBOX_STATIC_TOKEN)) && env.VII_MAPBOX_STATIC_TOKEN) {
    const token = encodeURIComponent(env.VII_MAPBOX_STATIC_TOKEN);
    const marker = `pin-s+087e8b(${candidate.lng.toFixed(6)},${candidate.lat.toFixed(6)})`;
    return {
      provider: "mapbox",
      url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${candidate.lng.toFixed(6)},${candidate.lat.toFixed(6)},${candidate.zoom},0/1200x600@2x?access_token=${token}&attribution=true&logo=true`,
      attribution: "© Mapbox © OpenStreetMap",
    };
  }
  if ((requested === "maptiler" || (!requested && env.VII_MAPTILER_API_KEY)) && env.VII_MAPTILER_API_KEY) {
    const key = encodeURIComponent(env.VII_MAPTILER_API_KEY);
    const marker = `${candidate.lng.toFixed(6)},${candidate.lat.toFixed(6)},%23087e8b`;
    return {
      provider: "maptiler",
      url: `https://api.maptiler.com/maps/streets-v4/static/${candidate.lng.toFixed(6)},${candidate.lat.toFixed(6)},${candidate.zoom}/1200x600@2x.webp?key=${key}&markers=${marker}&attribution=bottomright`,
      attribution: "© MapTiler © OpenStreetMap contributors",
    };
  }
  return null;
}

function errorCode(error: unknown) {
  const value = error instanceof Error ? error.message : String(error || "unknown_error");
  return value.replace(/[^a-z0-9_:-]+/gi, "_").slice(0, 160) || "unknown_error";
}

async function fetchStaticMap(request: StaticMapRequest, fetcher: typeof fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("static_map_timeout"), 12_000);
  try {
    const response = await fetcher(request.url, { signal: controller.signal, headers: { Accept: "image/webp,image/png,image/jpeg" } });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const contentType = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!new Set(["image/webp", "image/png", "image/jpeg"]).has(contentType)) throw new Error("provider_invalid_content_type");
    const body = await response.arrayBuffer();
    if (body.byteLength < MIN_IMAGE_BYTES) throw new Error("provider_image_too_small");
    if (body.byteLength > MAX_IMAGE_BYTES) throw new Error("provider_image_too_large");
    return { body, contentType };
  } finally {
    clearTimeout(timeout);
  }
}

function extension(contentType: string) {
  return contentType === "image/png" ? "png" : contentType === "image/jpeg" ? "jpg" : "webp";
}

async function currentRecord(db: D1Database, entityKey: string) {
  return db.prepare(`SELECT entity_key AS entityKey, source_hash AS sourceHash, status, object_key AS objectKey,
    retry_after AS retryAfter, lease_until AS leaseUntil FROM vii_map_snapshots_v1 WHERE entity_key = ?`)
    .bind(entityKey).first<{ entityKey: string; sourceHash: string; status: MapSnapshotStatus; objectKey: string | null; retryAfter: string | null; leaseUntil: string | null }>();
}

async function upsertCandidate(db: D1Database, candidate: MapSnapshotCandidate, entityKey: string, sourceHash: string, nowIso: string) {
  await db.prepare(`INSERT INTO vii_map_snapshots_v1
    (entity_key, world, place_id, place_name, latitude, longitude, precision, zoom, source_hash, status, checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'missing', ?)
    ON CONFLICT(entity_key) DO UPDATE SET place_name=excluded.place_name, latitude=excluded.latitude,
      longitude=excluded.longitude, precision=excluded.precision, zoom=excluded.zoom, checked_at=excluded.checked_at,
      status=CASE WHEN vii_map_snapshots_v1.source_hash<>excluded.source_hash THEN 'stale' ELSE vii_map_snapshots_v1.status END,
      retry_after=CASE WHEN vii_map_snapshots_v1.source_hash<>excluded.source_hash THEN NULL ELSE vii_map_snapshots_v1.retry_after END,
      last_error=CASE WHEN vii_map_snapshots_v1.source_hash<>excluded.source_hash THEN NULL ELSE vii_map_snapshots_v1.last_error END,
      source_hash=excluded.source_hash`)
    .bind(entityKey, candidate.world, candidate.placeId, candidate.name, candidate.lat, candidate.lng, candidate.precision, candidate.zoom, sourceHash, nowIso).run();
}

export type MapSnapshotReconcileResult = {
  total: number;
  generated: number;
  skipped: number;
  failed: number;
  providerConfigured: boolean;
  failures: Array<{ entityKey: string; code: string }>;
};

export async function reconcileMapSnapshots(options: {
  db: D1Database;
  bucket: R2Bucket;
  env: MapSnapshotProviderEnvironment;
  candidates: MapSnapshotCandidate[];
  now?: Date;
  limit?: number;
  fetcher?: typeof fetch;
  force?: boolean;
}): Promise<MapSnapshotReconcileResult> {
  const { db, bucket, env } = options;
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const fetcher = options.fetcher ?? fetch;
  const probe = options.candidates[0] ? staticMapRequest(options.candidates[0], env) : null;
  const result: MapSnapshotReconcileResult = { total: options.candidates.length, generated: 0, skipped: 0, failed: 0, providerConfigured: Boolean(probe), failures: [] };
  await ensureMapSnapshotSchema(db);

  let attempted = 0;
  for (const candidate of options.candidates) {
    const request = staticMapRequest(candidate, env);
    const provider = request?.provider || (env.VII_STATIC_MAP_PROVIDER || "unconfigured");
    const entityKey = mapSnapshotEntityKey(candidate.world, candidate.placeId);
    const sourceHash = mapSnapshotSourceHash(candidate, provider);
    await upsertCandidate(db, candidate, entityKey, sourceHash, nowIso);
    const record = await currentRecord(db, entityKey);
    const retryAt = record?.retryAfter ? Date.parse(record.retryAfter) : 0;
    const leasedUntil = record?.leaseUntil ? Date.parse(record.leaseUntil) : 0;
    if (record?.status === "ready" && record.sourceHash === sourceHash && record.objectKey) { result.skipped += 1; continue; }
    if (!options.force && Number.isFinite(retryAt) && retryAt > now.getTime()) { result.skipped += 1; continue; }
    if (Number.isFinite(leasedUntil) && leasedUntil > now.getTime()) { result.skipped += 1; continue; }
    if (attempted >= limit) { result.skipped += 1; continue; }
    attempted += 1;

    if (!request) {
      const code = "provider_not_configured";
      await db.prepare(`UPDATE vii_map_snapshots_v1 SET status='failed', last_error=?, retry_after=?, checked_at=? WHERE entity_key=?`)
        .bind(code, new Date(now.getTime() + FAILURE_RETRY_MS).toISOString(), nowIso, entityKey).run();
      result.failed += 1; result.failures.push({ entityKey, code });
      continue;
    }

    const leaseToken = crypto.randomUUID();
    const leaseUntil = new Date(now.getTime() + LEASE_MS).toISOString();
    const lease = await db.prepare(`UPDATE vii_map_snapshots_v1 SET status='processing', lease_token=?, lease_until=?, checked_at=?
      WHERE entity_key=? AND (lease_until IS NULL OR lease_until<=?)`)
      .bind(leaseToken, leaseUntil, nowIso, entityKey, nowIso).run();
    if (Number(lease.meta?.changes || 0) !== 1) { result.skipped += 1; continue; }

    try {
      const image = await fetchStaticMap(request, fetcher);
      const objectKey = `map-snapshots/v1/${safeSegment(candidate.world)}/${safeSegment(candidate.placeId)}/${sourceHash}.${extension(image.contentType)}`;
      await bucket.put(objectKey, image.body, { httpMetadata: { contentType: image.contentType, cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { entityKey, sourceHash, provider: request.provider, attribution: request.attribution } });
      await db.prepare(`UPDATE vii_map_snapshots_v1 SET status='ready', object_key=?, content_type=?, byte_size=?, width=?, height=?, provider=?, attribution=?,
        generated_at=?, checked_at=?, retry_after=NULL, lease_until=NULL, lease_token=NULL, last_error=NULL
        WHERE entity_key=? AND lease_token=?`)
        .bind(objectKey, image.contentType, image.body.byteLength, SNAPSHOT_WIDTH, SNAPSHOT_HEIGHT, request.provider, request.attribution, nowIso, nowIso, entityKey, leaseToken).run();
      result.generated += 1;
    } catch (error) {
      const code = errorCode(error);
      await db.prepare(`UPDATE vii_map_snapshots_v1 SET status='failed', last_error=?, retry_after=?, checked_at=?, lease_until=NULL, lease_token=NULL
        WHERE entity_key=? AND lease_token=?`)
        .bind(code, new Date(now.getTime() + FAILURE_RETRY_MS).toISOString(), nowIso, entityKey, leaseToken).run();
      result.failed += 1; result.failures.push({ entityKey, code });
    }
  }
  return result;
}

export function isWeeklyMapSnapshotWindow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(now).reduce<Record<string, string>>((accumulator, part) => ({ ...accumulator, [part.type]: part.value }), {});
  return parts.weekday === "Mon" && parts.hour === "03" && Number(parts.minute) >= 40 && Number(parts.minute) < 50;
}

export async function readMapSnapshot(db: D1Database, world: string, placeId: string): Promise<MapSnapshotRecord | null> {
  await ensureMapSnapshotSchema(db);
  return db.prepare(`SELECT entity_key AS entityKey, world, place_id AS placeId, source_hash AS sourceHash, status,
    object_key AS objectKey, content_type AS contentType, provider, attribution, generated_at AS generatedAt,
    checked_at AS checkedAt, last_error AS lastError FROM vii_map_snapshots_v1 WHERE entity_key=?`)
    .bind(mapSnapshotEntityKey(world, placeId)).first<MapSnapshotRecord>();
}

export async function readMapSnapshotDashboard(db: D1Database) {
  await ensureMapSnapshotSchema(db);
  const [totals, worlds, failures] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status='ready' AND object_key IS NOT NULL THEN 1 ELSE 0 END) AS ready,
      SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) AS processing,
      SUM(CASE WHEN status IN ('failed','missing','stale') OR object_key IS NULL THEN 1 ELSE 0 END) AS unresolved,
      MAX(generated_at) AS lastGeneratedAt, MAX(checked_at) AS lastCheckedAt FROM vii_map_snapshots_v1`).first<Record<string, unknown>>(),
    db.prepare(`SELECT world, COUNT(*) AS total,
      SUM(CASE WHEN status='ready' AND object_key IS NOT NULL THEN 1 ELSE 0 END) AS ready,
      SUM(CASE WHEN status IN ('failed','missing','stale') OR object_key IS NULL THEN 1 ELSE 0 END) AS unresolved
      FROM vii_map_snapshots_v1 GROUP BY world ORDER BY world`).all<Record<string, unknown>>(),
    db.prepare(`SELECT entity_key AS entityKey, world, place_id AS placeId, status, last_error AS lastError,
      checked_at AS checkedAt, retry_after AS retryAfter FROM vii_map_snapshots_v1
      WHERE status<>'ready' OR object_key IS NULL ORDER BY checked_at DESC LIMIT 100`).all<Record<string, unknown>>(),
  ]);
  return { totals, worlds: worlds.results, failures: failures.results };
}
