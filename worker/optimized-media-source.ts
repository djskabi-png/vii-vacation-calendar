const localGalleryPath = "/api/vii/media/";
const galleryObjectPrefix = "legacy-gallery/v1/";
const immutableCache = "public, max-age=31536000, immutable";
const safeGalleryFilename = /^[A-Za-z0-9._-]+\.(?:avif|gif|jfif|jpe?g|png|webp)$/i;

function contentTypeFor(filename: string, supplied?: string) {
  const normalized = supplied?.split(";")[0].trim().toLowerCase() || "";
  if (normalized.startsWith("image/")) return normalized;
  if (/\.(?:jpg|jpeg|jfif)$/i.test(filename)) return "image/jpeg";
  if (/\.png$/i.test(filename)) return "image/png";
  if (/\.webp$/i.test(filename)) return "image/webp";
  if (/\.gif$/i.test(filename)) return "image/gif";
  if (/\.avif$/i.test(filename)) return "image/avif";
  return "application/octet-stream";
}

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
  if (!safeGalleryFilename.test(filename) || filename.includes("..")) return null;
  return filename;
}

export async function optimizedMediaSource(path: string, uploads: R2Bucket, assets?: { fetch(request: Request): Promise<Response> }) {
  const filename = localGalleryFilename(path);
  if (!filename) return null;
  const object = await uploads.get(`${galleryObjectPrefix}${filename}`);
  if (!object) {
    const { recoverVerifiedGalleryMedia } = await import("../app/lib/verified-media-recovery.ts");
    return await recoverVerifiedGalleryMedia(new Request(new URL(path, "https://vii.spaplus.co")), filename, assets)
      || new Response("Image not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(filename, object.httpMetadata?.contentType),
      "Cache-Control": object.httpMetadata?.cacheControl || immutableCache,
      "X-Content-Type-Options": "nosniff",
      "X-VII-Media": "stored",
      ...(object.httpEtag ? { ETag: object.httpEtag } : {}),
    },
  });
}
