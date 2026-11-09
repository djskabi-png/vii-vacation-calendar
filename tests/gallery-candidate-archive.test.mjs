import assert from "node:assert/strict";
import test from "node:test";
import { archiveGalleryCandidate } from "../app/lib/gallery-candidate-archive.ts";

const jpeg = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1]);
function fake({ existing = {}, race = false } = {}) { const map = new Map(Object.entries(existing)); const gets = [], puts = []; return { gets, puts, async head(key) { gets.push(key); const value = map.get(key); return value ? { size: value.length, httpMetadata: { contentType: "image/jpeg" }, httpEtag: "etag" } : null; }, async get() { return { size: jpeg.length, body: new Response("<html>").body, httpMetadata: { contentType: "image/jpeg" } }; }, async put(key, value) { puts.push(key); if (race) return null; map.set(key, value); return { httpEtag: "new" }; } }; }
const entry = (url) => ({ supplierId: 1, detail: { images: [url], galleryGroups: [{ images: [url] }], rooms: [{ id: 2, images: [url] }] } });
const fetchOk = async () => new Response(jpeg, { status: 200, headers: { "content-type": "image/jpeg", "content-length": String(jpeg.length) } });

test("archives each new filename before acceptance", async () => { const bucket = fake(); const result = await archiveGalleryCandidate({ previous: entry("https://www.vii.co.il/gallery/old.jpg"), candidate: entry("https://www.vii.co.il/gallery/new.jpg"), bucket, fetchImpl: fetchOk }); assert.equal(result.complete, true); assert.deepEqual(result.archived[0].filename, "new.jpg"); assert.equal(result.archived[0].bytes, jpeg.length); assert.equal(bucket.puts.length, 1); });
test("same old references do not GET or PUT", async () => { const bucket = fake({ existing: { "legacy-gallery/v1/old.jpg": jpeg } }); const result = await archiveGalleryCandidate({ previous: entry("https://www.vii.co.il/gallery/old.jpg"), candidate: entry("/api/vii/media/old.jpg"), bucket, fetchImpl: async () => { throw Error("unexpected_get"); } }); assert.deepEqual(result, { archived: [], skipped: [], complete: true }); assert.equal(bucket.puts.length, 0); });
test("redirect, HTML and bad magic fail closed", async () => { const bucket = fake(); await assert.rejects(() => archiveGalleryCandidate({ previous: entry("/api/vii/media/old.jpg"), candidate: entry("https://www.vii.co.il/gallery/a.jpg"), bucket, fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://evil.test" } }) }), /archive_source_redirect/); await assert.rejects(() => archiveGalleryCandidate({ previous: entry("/api/vii/media/old.jpg"), candidate: entry("https://www.vii.co.il/gallery/a.jpg"), bucket, fetchImpl: async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }) }), /archive_image_type_invalid/); });
test("conditional race requires a valid winner", async () => { const bucket = fake({ race: true }); await assert.rejects(() => archiveGalleryCandidate({ previous: entry("/api/vii/media/old.jpg"), candidate: entry("https://www.vii.co.il/gallery/race.jpg"), bucket, fetchImpl: fetchOk }), /archive_conditional_race_invalid/); });
test("missing storage fails closed for a new image", async () => { const bucket = fake(); await assert.rejects(() => archiveGalleryCandidate({ previous: entry("/api/vii/media/old.jpg"), candidate: entry("https://www.vii.co.il/gallery/missing.jpg"), bucket, fetchImpl: async () => new Response(null, { status: 404 }) }), /archive_source_http_404/); });
test("more than 256 new filenames requires resume", async () => { const previous = { detail: { images: [] } }, candidate = { detail: { images: Array.from({ length: 257 }, (_, i) => `https://www.vii.co.il/gallery/${i}.jpg`) } }; await assert.rejects(() => archiveGalleryCandidate({ previous, candidate, bucket: fake() }), /archive_batch_requires_resume/); });

test("existing image metadata cannot conceal invalid bytes or a wrong digest", async () => {
  const check = (body, sha256) => archiveGalleryCandidate({ previous: entry('/api/vii/media/old.jpg'), candidate: entry('/api/vii/media/new.jpg'),
    bucket: { async head(){return {size:body.length,httpMetadata:{contentType:'image/jpeg'}};}, async get(){return {size:body.length,httpMetadata:{contentType:'image/jpeg'},customMetadata:sha256?{sha256}:{},body:new Response(body).body};} }, fetchImpl:async()=>{throw Error('must_not_fetch');} });
  await assert.rejects(()=>check(new TextEncoder().encode('<html>bad</html>')),/archive_existing_invalid/);
  await assert.rejects(()=>check(jpeg,'0'.repeat(64)),/archive_existing_checksum_mismatch/);
});

test("an injected clock is used consistently during archival", async () => {
  const result=await archiveGalleryCandidate({previous:entry('/api/vii/media/old.jpg'),candidate:entry('/api/vii/media/new.jpg'),bucket:fake(),fetchImpl:fetchOk,now:()=>0});
  assert.equal(result.complete,true);
});
