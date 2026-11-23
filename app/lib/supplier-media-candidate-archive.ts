import type { R2Bucket } from "../../types/cloudflare-runtime";
import { supplierMediaSource } from "./supplier-media-identity.ts";
import { archiveSupplierMedia, type SupplierMediaReceipt } from "./supplier-media-store.ts";

const mediaFields = new Set(["image", "images", "gallery", "pictures"]);
type Entry = { summary?: unknown; detail?: unknown };

export function collectSupplierMediaSources(value: unknown, output = new Set<string>(), media = false): Set<string> {
  if (Array.isArray(value)) { for (const item of value) collectSupplierMediaSources(item, output, media); return output; }
  if (typeof value === "string") {
    if (media) { const source = supplierMediaSource(value); if (source) output.add(source); }
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const isMedia = media || mediaFields.has(key) || key === "galleryGroups";
    if (isMedia || ["rooms", "packages", "summary", "detail"].includes(key)) collectSupplierMediaSources(item, output, isMedia);
  }
  return output;
}

export async function archiveNewSupplierMediaCandidate(input: {
  previous: Entry;
  candidate: Entry;
  bucket: R2Bucket;
  fetchImpl?: typeof fetch;
}) {
  const before = collectSupplierMediaSources(input.previous);
  const after = collectSupplierMediaSources(input.candidate);
  const pending = [...after].filter(source => !before.has(source));
  if (pending.length > 128) throw Error("supplier_media_batch_requires_backfill");
  const archived: SupplierMediaReceipt[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const source = pending[cursor++];
      archived.push(await archiveSupplierMedia(source, input.bucket, input.fetchImpl));
    }
  }
  const results = await Promise.allSettled(Array.from({ length: Math.min(3, pending.length || 1) }, worker));
  const failure = results.find(result => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  return { total: after.size, introduced: pending.length, archived };
}

