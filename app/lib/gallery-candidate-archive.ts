import type { R2Bucket } from "../../types/cloudflare-runtime";
import { legacyGalleryFilename } from "./legacy-gallery-media.ts";
import { PUBLIC_GALLERY_OBJECT_PREFIX, storedGalleryContentType } from "./gallery-media-identity.ts";
import { sourceImageMagic } from "./catalog-media-origin-recovery.ts";

const MAX = 12_000_000, CAP = 256, CONCURRENCY = 2, BUDGET = 30_000;
type Entry = { summary?: unknown; detail?: unknown };
type Receipt = { archived: Array<{ filename: string; bytes?: number; sha256?: string }>; skipped: string[]; complete: boolean };
const mediaFields = new Set(["image", "images", "gallery"]);
function collect(value: unknown, out: Set<string>) {
  if (Array.isArray(value)) return value.forEach(item => collect(item, out));
  if (!value || typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(row)) {
    if (mediaFields.has(key) || key === "galleryGroups") collectMedia(item, out);
    else if (["rooms", "packages", "summary", "detail"].includes(key)) collect(item, out);
  }
}
function collectMedia(value: unknown, out: Set<string>) {
  if (Array.isArray(value)) return value.forEach(item => collectMedia(item, out));
  if (typeof value === "string") { const filename = legacyGalleryFilename(value); if (filename) out.add(filename); return; }
  if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) if (mediaFields.has(key) || key === "pictures" || key === "galleryGroups") collectMedia(item, out);
}
function digest(bytes: Uint8Array<ArrayBuffer>) { return crypto.subtle.digest("SHA-256", bytes).then(hash => [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, "0")).join("")); }
async function readBody(response: Response, deadline: number, clock: () => number) {
  if (clock() > deadline) throw Error("archive_budget_requires_resume");
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) < 1 || Number(length) > MAX)) throw Error("archive_image_size_invalid");
  if (!response.body) throw Error("archive_image_body_missing");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > MAX) throw Error("archive_image_too_large"); chunks.push(part.value); } }
  catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  if (!size || (length && Number(length) !== size)) throw Error("archive_image_size_mismatch");
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } return bytes;
}
async function archiveOne(filename: string, bucket: R2Bucket, fetchImpl: typeof fetch, deadline: number, clock: () => number) {
  const key = `${PUBLIC_GALLERY_OBJECT_PREFIX}${filename}`, existing = await bucket.head(key);
  if (existing) {
    const type = storedGalleryContentType(existing.httpMetadata?.contentType);
    if (!type || !(existing.size > 0 && existing.size <= MAX)) throw Error("archive_existing_invalid");
    const object = await bucket.get(key);
    if (!object || storedGalleryContentType(object.httpMetadata?.contentType) !== type || object.size !== existing.size) throw Error("archive_existing_invalid");
    let bytes: Awaited<ReturnType<typeof readBody>>;
    try { bytes = await readBody(new Response(object.body as unknown as ReadableStream, { headers: { "content-length": String(object.size) } }), deadline, clock); }
    catch { throw Error("archive_existing_invalid"); }
    if (!sourceImageMagic(bytes, type)) throw Error("archive_existing_invalid");
    const sha256 = await digest(bytes), recorded = object.customMetadata?.sha256;
    if (recorded !== undefined && (!/^[a-f0-9]{64}$/i.test(recorded) || recorded.toLowerCase() !== sha256)) throw Error("archive_existing_checksum_mismatch");
    return { filename, bytes: bytes.byteLength, sha256, skipped: true };
  }
  if (clock() > deadline) throw Error("archive_batch_requires_resume");
  const response = await fetchImpl(`https://www.vii.co.il/gallery/${encodeURIComponent(filename)}`, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(Math.min(8_000, Math.max(1, deadline - clock()))) });
  if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); throw Error("archive_source_redirect"); }
  if (!response.ok) { await response.body?.cancel(); throw Error(`archive_source_http_${response.status}`); }
  const type = storedGalleryContentType(response.headers.get("content-type")); if (!type) { await response.body?.cancel(); throw Error("archive_image_type_invalid"); }
  const bytes = await readBody(response, deadline, clock); if (!sourceImageMagic(bytes, type)) throw Error("archive_image_magic_invalid");
  const sha256 = await digest(bytes); const stored = await bucket.put(key, bytes, { onlyIf: { etagDoesNotMatch: "*" }, httpMetadata: { contentType: type }, customMetadata: { sha256, source: `https://www.vii.co.il/gallery/${filename}` } });
  if (!stored) {
    const winner = await bucket.get(key); if (!winner) throw Error("archive_conditional_race_invalid");
    const winnerType = storedGalleryContentType(winner.httpMetadata?.contentType); if (winnerType !== type || !(winner.size > 0 && winner.size <= MAX)) throw Error("archive_conditional_race_invalid");
    let winning: Awaited<ReturnType<typeof readBody>>; try { winning = await readBody(new Response(winner.body as unknown as ReadableStream, { headers: { "content-length": String(winner.size) } }), deadline, clock); } catch { throw Error("archive_conditional_race_invalid"); }
    if (!sourceImageMagic(winning, type) || await digest(winning) !== sha256) throw Error("archive_conditional_race_invalid");
    return { filename, bytes: winning.byteLength, sha256 };
  }
  return { filename, bytes: bytes.byteLength, sha256 };
}
export async function archiveGalleryCandidate({ previous, candidate, bucket, fetchImpl = fetch, now = Date.now }: { previous: Entry; candidate: Entry; bucket: R2Bucket; fetchImpl?: typeof fetch; now?: () => number }): Promise<Receipt> {
  const before = new Set<string>(), after = new Set<string>(); collect(previous, before); collect(candidate, after);
  const files = [...after].filter(filename => !before.has(filename)); if (files.length > CAP) throw Error("archive_batch_requires_resume");
  const start = now(), deadline = start + BUDGET, archived: Receipt["archived"] = [], skipped: string[] = [];
  let cursor = 0;
  async function worker() { while (cursor < files.length) { if (now() >= deadline) throw Error("archive_batch_requires_resume"); const filename = files[cursor++]; const result = await archiveOne(filename, bucket, fetchImpl, deadline, now); if (result.skipped) skipped.push(filename); else archived.push({ filename, bytes: result.bytes, ...(result.sha256 ? { sha256: result.sha256 } : {}) }); } }
  const results = await Promise.allSettled(Array.from({ length: Math.min(CONCURRENCY, files.length || 1) }, worker));
  const failure = results.find(result => result.status === "rejected"); if (failure) throw failure.reason;
  if (now() >= deadline) throw Error("archive_batch_requires_resume");
  return { archived, skipped, complete: true };
}
