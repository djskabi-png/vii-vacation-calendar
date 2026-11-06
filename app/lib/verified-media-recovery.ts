import manifest from "../data/verified-media-recovery.json" with { type: "json" };

type AssetReader = { fetch(request: Request): Promise<Response> };
const files = new Map(manifest.files.map(file => [file.filename, file]));

/** Only previously verified supplier bytes may recover an absent R2 object.
 * No network origin fetch, generated image or another unit can enter this path. */
export async function recoverVerifiedGalleryMedia(request: Request, filename: string, assets?: AssetReader) {
  const file = files.get(filename);
  if (!file || !assets || !["GET", "HEAD"].includes(request.method)) return null;
  const asset = await assets.fetch(new Request(new URL(file.path, request.url), { headers: { Accept: file.contentType } }));
  if (!asset.ok || asset.headers.get("Content-Type")?.split(";")[0] !== file.contentType) return null;
  const announced = asset.headers.get("Content-Length");
  if (announced && Number(announced) !== file.bytes) return null;
  const bytes = await asset.arrayBuffer();
  if (bytes.byteLength !== file.bytes) return null;
  const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
  if (sha !== file.sha256) return null;
  return new Response(request.method === "HEAD" ? null : bytes, { headers: {
    "Content-Type": file.contentType, "Content-Length": String(file.bytes),
    "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
    "X-VII-Media": "recovered", ETag: `"sha256-${sha}"`,
  } });
}
