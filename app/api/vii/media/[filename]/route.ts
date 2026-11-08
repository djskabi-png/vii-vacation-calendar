import { legacyGalleryBucket } from "../../../../lib/legacy-gallery-storage";
import { PUBLIC_GALLERY_OBJECT_PREFIX, validGalleryFilename, storedGalleryContentType } from "../../../../lib/gallery-media-identity.ts";

const prefix = PUBLIC_GALLERY_OBJECT_PREFIX;
// This is enabled only for the bounded migration release. The final release
// flips it off after every allowlisted object is verified in R2.
const ALLOW_LEGACY_ORIGIN_FETCH = false;
const immutable = "public, max-age=31536000, immutable";

function validFilename(filename: string) {
  // The immutable R2 prefix is the authority. Do not gate reads by the
  // build-time manifest: a newly migrated supplier image can be present in
  // R2 before the next application bundle is generated. Recovery remains
  // separately manifest-verified below.
  return validGalleryFilename(filename);
}

function legacyContentType(filename: string, header: string | null) {
  const supplied = header?.split(";")[0].trim().toLowerCase() || "";
  if (supplied.startsWith("image/")) return supplied;
  if (/\.(?:jpg|jpeg|jfif)$/i.test(filename)) return "image/jpeg";
  if (/\.png$/i.test(filename)) return "image/png";
  if (/\.webp$/i.test(filename)) return "image/webp";
  if (/\.gif$/i.test(filename)) return "image/gif";
  if (/\.avif$/i.test(filename)) return "image/avif";
  return "";
}

export function isStoredImageContentType(contentType: string | null | undefined) {
  return storedGalleryContentType(contentType) !== null;
}

function responseHeaders(contentType: string, source: "stored" | "migrated", etag?: string) {
  return {
    "Content-Type": contentType,
    "Cache-Control": immutable,
    "X-Content-Type-Options": "nosniff",
    "X-VII-Media": source,
    ...(etag ? { ETag: etag } : {}),
  };
}

async function recovery(request: Request, filename: string) {
  const { env } = await import("cloudflare:workers");
  const { recoverVerifiedGalleryMedia } = await import("../../../../lib/verified-media-recovery.ts");
  return recoverVerifiedGalleryMedia(request, filename, (env as unknown as { ASSETS?: { fetch(request: Request): Promise<Response> } }).ASSETS);
}

async function storedObject(filename: string) {
  const bucket = await legacyGalleryBucket();
  return { bucket, object: await bucket.get(`${prefix}${filename}`) };
}

export async function HEAD(request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!validFilename(filename)) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    const { object } = await storedObject(filename);
    if (!object) return await recovery(request, filename) || new Response(null, { status: 404, headers: { "Cache-Control": "no-store", "X-VII-Media": "missing" } });
    const contentType = object.httpMetadata?.contentType || "";
    if (!isStoredImageContentType(contentType)) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store", "X-VII-Media": "non-image" } });
    return new Response(null, { status: 200, headers: responseHeaders(contentType, "stored", object.httpEtag) });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!validFilename(filename)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    const { bucket, object } = await storedObject(filename);
    if (object) {
      const contentType = object.httpMetadata?.contentType || "";
      if (!isStoredImageContentType(contentType)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-VII-Media": "non-image" } });
      return new Response(object.body as ReadableStream, { headers: responseHeaders(contentType, "stored", object.httpEtag) });
    }
    const recovered = await recovery(request, filename);
    if (recovered) return recovered;
    if (!ALLOW_LEGACY_ORIGIN_FETCH) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-VII-Media": "missing" } });
    const sourceUrl = `https://www.vii.co.il/gallery/${encodeURIComponent(filename)}`;
    const upstream = await fetch(sourceUrl, { headers: { Accept: "image/avif,image/webp,image/*" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const contentType = legacyContentType(filename, upstream.headers.get("Content-Type"));
    const length = Number(upstream.headers.get("Content-Length") || 0);
    if (!upstream.ok || !contentType.startsWith("image/") || length > 20_000_000) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    const body = await upstream.arrayBuffer();
    if (!body.byteLength || body.byteLength > 20_000_000) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    const stored = await bucket.put(`${prefix}${filename}`, body, {
      httpMetadata: { contentType, cacheControl: immutable },
      customMetadata: { migratedFrom: "legacy-vii-gallery", migratedAt: new Date().toISOString() },
    });
    return new Response(body, { headers: responseHeaders(contentType, "migrated", stored.httpEtag) });
  } catch {
    return new Response("Media unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
