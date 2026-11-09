import type { D1Database, R2Bucket } from "../../types/cloudflare-runtime";
import { localGalleryMediaUrl } from "./legacy-gallery-media.ts";
import { PUBLIC_GALLERY_OBJECT_PREFIX, storedGalleryContentType, validGalleryFilename } from "./gallery-media-identity.ts";

const MAX_BYTES = 8_000_000;
type WriteOptions = NonNullable<Parameters<R2Bucket["put"]>[2]>;
const authorization = new WeakMap<D1Database, Map<string, { until: number; allowed: boolean }>>();
type Image = { bytes: Uint8Array; type: string; etag?: string };
const operations = new WeakMap<R2Bucket, Map<string, Promise<Image | null>>>();
let active = 0;
const waiting: Array<() => void> = [];
function acquire(signal: AbortSignal): Promise<() => void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const start = () => {
      signal.removeEventListener("abort", cancel);
      active++;
      resolve(() => { active--; waiting.shift()?.(); });
    };
    const cancel = () => {
      const index = waiting.indexOf(start);
      if (index >= 0) waiting.splice(index, 1);
      reject(signal.reason);
    };
    if (active < 2) start();
    else if (waiting.length < 16) { waiting.push(start); signal.addEventListener("abort", cancel, { once: true }); }
    else reject(Error("media_recovery_capacity"));
  });
}

function referenced(value: unknown, filename: string): boolean {
  if (Array.isArray(value)) return value.some(item => referenced(item, filename));
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  for (const field of ["images", "pictures", "gallery"]) {
    if (Array.isArray(row[field]) && row[field].some((src: unknown) =>
      typeof src === "string" && localGalleryMediaUrl(src) === `/api/vii/media/${filename}`)) return true;
  }
  return ["galleryGroups", "rooms", "summary", "detail"].some(key => referenced(row[key], filename));
}

export async function catalogReferencesGallery(db: D1Database, filename: string, now = Date.now()) {
  if (!validGalleryFilename(filename)) return false;
  let cache = authorization.get(db);
  if (!cache) { cache = new Map(); authorization.set(db, cache); }
  const hit = cache.get(filename);
  if (hit && hit.until > now) return hit.allowed;
  const rows = await db.prepare(`SELECT e.summary_json AS summaryJson, e.detail_json AS detailJson
    FROM supplier_catalog_entries e JOIN supplier_catalog_state s
      ON s.world=e.world AND s.active_run_id=e.run_id
    WHERE e.world IN ('vacations','events','rooms','spa')
      AND (INSTR(e.summary_json, ?) > 0 OR INSTR(e.detail_json, ?) > 0) LIMIT 8`)
    .bind(filename, filename).all<{ summaryJson: string; detailJson: string | null }>();
  const allowed = (rows.results || []).some(row => [row.summaryJson, row.detailJson].some(raw => {
    if (!raw) return false;
    try { return referenced(JSON.parse(raw), filename); } catch { return false; }
  }));
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(filename, { allowed, until: now + (allowed ? 300_000 : 10_000) });
  return allowed;
}

export function sourceImageMagic(bytes: Uint8Array, type: string) {
  if (bytes.length < 12) return false;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (type === "image/jpeg" || type === "image/jfif") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png") return [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  if (type === "image/gif") return ["GIF87a", "GIF89a"].includes(ascii(0,6));
  if (type === "image/webp") return ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP";
  if (type === "image/avif") return ascii(4,8) === "ftyp" && /(?:avif|avis)/.test(ascii(8,Math.min(64,bytes.length)));
  return false;
}

async function boundedImage(response: Response) {
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) < 1 || Number(length) > MAX_BYTES)) {
    await response.body?.cancel(); throw Error("source_image_size_invalid");
  }
  if (!response.body) throw Error("source_image_body_missing");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw Error("source_image_too_large"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  if (!size || (length !== null && Number(length) !== size)) throw Error("source_image_size_mismatch");
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** Cache exact official-source bytes only for current accepted supplier media.
 * The caller tries existing R2 and verified static assets before this path. */
export async function recoverCatalogMedia(request: Request, filename: string,
  env: { DB?: D1Database; UPLOADS?: R2Bucket }, fetcher: typeof fetch = fetch) {
  if (!validGalleryFilename(filename) || !["GET", "HEAD"].includes(request.method)) return null;
  if (!env.DB || !env.UPLOADS) throw Error("media_storage_unavailable");
  const db = env.DB, bucket = env.UPLOADS;
  let pending = operations.get(bucket);
  if (!pending) { pending = new Map(); operations.set(bucket, pending); }
  let operation = pending.get(filename);
  if (!operation) {
    operation = (async (): Promise<Image | null> => {
      const deadline = AbortSignal.timeout(8_000);
      const release = await acquire(deadline);
      try {
      if (!await catalogReferencesGallery(db, filename)) return null;
      const key = `${PUBLIC_GALLERY_OBJECT_PREFIX}${filename}`;
      // Re-read before writing, including after an earlier uncertain PUT.
      const existing = await bucket.get(key);
      if (existing) {
        const type = storedGalleryContentType(existing.httpMetadata?.contentType);
        if (!type || existing.size > MAX_BYTES) throw Error("stored_image_invalid");
        // DOM and Workers declarations describe the same runtime web stream.
        return { bytes: await boundedImage(new Response(existing.body as unknown as ReadableStream, { headers: { "Content-Length": String(existing.size) } })), type, etag: existing.httpEtag };
      }
      const sourceUrl = `https://www.vii.co.il/gallery/${encodeURIComponent(filename)}`;
      const upstream = await fetcher(sourceUrl, { redirect: "error", cache: "no-store",
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" }, signal: deadline });
      if (upstream.status === 404 || upstream.status === 410) { await upstream.body?.cancel(); return null; }
      if (!upstream.ok) { await upstream.body?.cancel(); throw Error("source_image_unavailable"); }
      const type = storedGalleryContentType(upstream.headers.get("Content-Type"));
      if (!type) { await upstream.body?.cancel(); throw Error("source_image_type_invalid"); }
      const bytes = await boundedImage(upstream);
      if (!sourceImageMagic(bytes, type)) throw Error("source_image_magic_invalid");
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2,"0")).join("");
      const stored = await bucket.put(key, bytes, { onlyIf: new Headers({ "If-None-Match": "*" }) as unknown as WriteOptions["onlyIf"],
        httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" },
        customMetadata: { source: "accepted-supplier-gallery", sourceUrl, sha256: digest } });
      if (!stored) {
        const winner = await bucket.get(key);
        if (!winner || winner.size > MAX_BYTES || storedGalleryContentType(winner.httpMetadata?.contentType) !== type) throw Error("conditional_media_write_unresolved");
        const winning = await boundedImage(new Response(winner.body as unknown as ReadableStream, { headers: { "Content-Length": String(winner.size) } }));
        if (!sourceImageMagic(winning, type)) throw Error("conditional_media_write_invalid");
        return { bytes: winning, type, etag: winner.httpEtag };
      }
      return { bytes, type, etag: stored.httpEtag };
      } finally { release(); }
    })().finally(() => { pending!.delete(filename); });
    pending.set(filename, operation);
  }
  const image = await operation;
  if (!image) return null;
  return new Response(request.method === "HEAD" ? null : image.bytes.slice(), { headers: {
    "Content-Type": image.type, "Content-Length": String(image.bytes.byteLength),
    "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
    "X-VII-Media": "catalog-imported", ...(image.etag ? { ETag: image.etag } : {}),
  } });
}
