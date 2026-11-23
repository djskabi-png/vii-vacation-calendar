import { legacyGalleryBucket } from "../../../../lib/legacy-gallery-storage.ts";
import { supplierMediaSourceFromToken } from "../../../../lib/supplier-media-identity.ts";
import { storedSupplierMedia } from "../../../../lib/supplier-media-store.ts";
import type { D1Database } from "../../../../../types/cloudflare-runtime.ts";

const cache = "public, max-age=86400, stale-while-revalidate=604800";

async function stored(token: string) {
  if (!supplierMediaSourceFromToken(token)) return null;
  return storedSupplierMedia(await legacyGalleryBucket(), token);
}

async function recover(token: string) {
  const { env } = await import("cloudflare:workers");
  const bucket = await legacyGalleryBucket();
  const { recoverSupplierMedia } = await import("../../../../lib/supplier-media-recovery.ts");
  const recovered = await recoverSupplierMedia(token, { DB: (env as unknown as { DB?: D1Database }).DB, UPLOADS: bucket });
  return recovered ? storedSupplierMedia(bucket, token) : null;
}

export async function HEAD(_request: Request, context: { params: Promise<{ token: string }> }) {
  const token = decodeURIComponent((await context.params).token);
  try {
    const media = await stored(token) || await recover(token);
    if (!media) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store", "X-VII-Media": "missing" } });
    return new Response(null, { headers: {
      "Content-Type": media.manifest.contentType,
      "Content-Length": String(media.manifest.bytes),
      "Cache-Control": cache,
      "ETag": `"${media.manifest.sha256}"`,
      "X-Content-Type-Options": "nosniff",
      "X-VII-Media": "supplier-stored",
    } });
  } catch { return new Response(null, { status: 503, headers: { "Cache-Control": "no-store", "X-VII-Media": "corrupt" } }); }
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const token = decodeURIComponent((await context.params).token);
  try {
    const media = await stored(token) || await recover(token);
    if (!media) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-VII-Media": "missing" } });
    return new Response(media.object.body as ReadableStream, { headers: {
      "Content-Type": media.manifest.contentType,
      "Content-Length": String(media.manifest.bytes),
      "Cache-Control": cache,
      "ETag": `"${media.manifest.sha256}"`,
      "X-Content-Type-Options": "nosniff",
      "X-VII-Media": "supplier-stored",
    } });
  } catch { return new Response("Media unavailable", { status: 503, headers: { "Cache-Control": "no-store", "X-VII-Media": "corrupt" } }); }
}

