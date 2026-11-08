import { PUBLIC_GALLERY_OBJECT_PREFIX, validGalleryFilename, storedGalleryContentType } from "../app/lib/gallery-media-identity.ts";
/** Safe identities read only the public immutable R2 prefix. A stale build
 * manifest must not reject an image already accepted into that prefix. */
export async function servePublicGalleryMedia(request: Request, uploads?: R2Bucket, assets?: { fetch(request: Request): Promise<Response> }): Promise<Response> {
  const encoded = new URL(request.url).pathname.slice("/api/vii/media/".length);
  let filename: string;
  try { filename = decodeURIComponent(encoded); } catch { filename = ""; }
  const body = (text: string) => request.method === "HEAD" ? null : text;
  if (!validGalleryFilename(filename)) return new Response(body("Not found"), { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    if (!uploads) throw new Error("media_binding_unavailable");
    const object = await uploads.get(`${PUBLIC_GALLERY_OBJECT_PREFIX}${filename}`);
    if (!object) {
      const { recoverVerifiedGalleryMedia } = await import("../app/lib/verified-media-recovery.ts");
      const recovered = await recoverVerifiedGalleryMedia(request, filename, assets);
      return recovered || new Response(body("Not found"), { status: 404, headers: { "Cache-Control": "no-store", "X-VII-Media": "missing" } });
    }
    const contentType = storedGalleryContentType(object.httpMetadata?.contentType);
    if (!contentType) return new Response(body("Not found"), { status: 404, headers: { "Cache-Control": "no-store", "X-VII-Media": "non-image" } });
    return new Response(request.method === "HEAD" ? null : object.body, { headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff", "X-VII-Media": "stored",
      ...(object.httpEtag ? { ETag: object.httpEtag } : {}),
    } });
  } catch { return new Response(body("Media unavailable"), { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
