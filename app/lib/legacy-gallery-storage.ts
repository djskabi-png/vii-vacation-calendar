import type { R2Bucket } from "../../types/cloudflare-runtime";

export async function legacyGalleryBucket() {
  const runtime = await import("cloudflare:workers");
  const bucket = (runtime.env as unknown as { UPLOADS?: R2Bucket }).UPLOADS;
  if (!bucket) throw new Error("legacy_gallery_storage_unavailable");
  return bucket;
}
