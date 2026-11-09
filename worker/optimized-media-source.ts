import { PUBLIC_GALLERY_OBJECT_PREFIX, validGalleryFilename, storedGalleryContentType } from "../app/lib/gallery-media-identity.ts";
const localGalleryPath = "/api/vii/media/";
const immutableCache = "public, max-age=31536000, immutable";

export function localGalleryFilename(path: string) {
  if (!path.startsWith(localGalleryPath) || path.includes("?") || path.includes("#")) return null;
  const encoded = path.slice(localGalleryPath.length);
  if (!encoded || encoded.includes("/") || encoded.includes("\\")) return null;
  let filename = "";
  try {
    filename = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  if (!validGalleryFilename(filename)) return null;
  return filename;
}

export async function optimizedMediaSource(path: string, uploads: R2Bucket, assets?: { fetch(request: Request): Promise<Response> }, db?: D1Database) {
  const filename = localGalleryFilename(path);
  if (!filename) return null;
  const object = await uploads.get(`${PUBLIC_GALLERY_OBJECT_PREFIX}${filename}`);
  if (!object) {
    const { recoverVerifiedGalleryMedia } = await import("../app/lib/verified-media-recovery.ts");
    const request = new Request(new URL(path, "https://vii.spaplus.co"));
    let recovered = await recoverVerifiedGalleryMedia(request, filename, assets);
    if (!recovered && db) {
      const { recoverCatalogMedia } = await import("../app/lib/catalog-media-origin-recovery.ts");
      recovered = await recoverCatalogMedia(request, filename, { DB: db, UPLOADS: uploads });
    }
    return recovered
      || new Response("Image not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const contentType = storedGalleryContentType(object.httpMetadata?.contentType);
  if (!contentType) return new Response("Image not found", { status: 404, headers: { "Cache-Control": "no-store", "X-VII-Media": "non-image" } });
  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": object.httpMetadata?.cacheControl || immutableCache,
      "X-Content-Type-Options": "nosniff",
      "X-VII-Media": "stored",
      ...(object.httpEtag ? { ETag: object.httpEtag } : {}),
    },
  });
}
