import manifest from "../app/data/legacy-gallery-media.json" with { type: "json" };
const files = new Set<string>(manifest.files);
/** The same accepted manifest and object prefix as the existing public API. */
export async function servePublicGalleryMedia(request: Request, uploads?: R2Bucket, assets?: { fetch(request: Request): Promise<Response> }): Promise<Response> {
  const encoded = new URL(request.url).pathname.slice("/api/vii/media/".length);
  let filename: string;
  try { filename = decodeURIComponent(encoded); } catch { filename = ""; }
  const body = (text: string) => request.method === "HEAD" ? null : text;
  if (!/^[A-Za-z0-9._-]+\.(?:avif|gif|jfif|jpe?g|png|webp)$/i.test(filename) || !files.has(filename)) return new Response(body("Not found"), { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    if (!uploads) throw new Error("media_binding_unavailable");
    const object = await uploads.get(`${manifest.objectPrefix}${filename}`);
    if (!object) {
      const { recoverVerifiedGalleryMedia } = await import("../app/lib/verified-media-recovery.ts");
      const recovered = await recoverVerifiedGalleryMedia(request, filename, assets);
      return recovered || new Response(body("Not found"), { status: 404, headers: { "Cache-Control": "no-store", "X-VII-Media": "missing" } });
    }
    return new Response(request.method === "HEAD" ? null : object.body, { headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff", "X-VII-Media": "stored",
      ...(object.httpEtag ? { ETag: object.httpEtag } : {}),
    } });
  } catch { return new Response(body("Media unavailable"), { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
