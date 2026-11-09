import { legacyGalleryBucket } from "../../../../lib/legacy-gallery-storage";
import { PUBLIC_GALLERY_OBJECT_PREFIX, validGalleryFilename, storedGalleryContentType } from "../../../../lib/gallery-media-identity.ts";

const prefix = PUBLIC_GALLERY_OBJECT_PREFIX;
// Only accepted catalog references can import an absent supplier image.
const immutable = "public, max-age=31536000, immutable";

function validFilename(filename: string) {
  // The immutable R2 prefix is the authority. Do not gate reads by the
  // build-time manifest: a newly migrated supplier image can be present in
  // R2 before the next application bundle is generated. Recovery remains
  // separately manifest-verified below.
  return validGalleryFilename(filename);
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

async function recoverFromLegacyOrigin(request: Request, filename: string, bucket: Awaited<ReturnType<typeof legacyGalleryBucket>>) {
  const { env } = await import("cloudflare:workers");
  const { recoverCatalogMedia } = await import("../../../../lib/catalog-media-origin-recovery.ts");
  return recoverCatalogMedia(request, filename, { DB: (env as { DB?: import("../../../../types/cloudflare-runtime").D1Database }).DB, UPLOADS: bucket });
}

async function storedObject(filename: string) {
  const bucket = await legacyGalleryBucket();
  return { bucket, object: await bucket.get(`${prefix}${filename}`) };
}

export async function HEAD(request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!validFilename(filename)) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    const { bucket, object } = await storedObject(filename);
    if (!object) return await recovery(request, filename) || await recoverFromLegacyOrigin(request, filename, bucket) || new Response(null, { status: 404, headers: { "Cache-Control": "no-store", "X-VII-Media": "missing" } });
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
    return await recoverFromLegacyOrigin(request, filename, bucket) || new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-VII-Media": "missing" } });
  } catch {
    return new Response("Media unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
