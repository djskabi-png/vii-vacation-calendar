import test from "node:test";
import assert from "node:assert/strict";
import spa from "../app/data/spaplus-catalog.json" with { type: "json" };
import {
  canonicalSupplierMediaSource, localSupplierMediaUrl, supplierMediaSource,
  supplierMediaSourceFromToken, supplierMediaToken,
} from "../app/lib/supplier-media-identity.ts";
import { archiveSupplierMedia, readSupplierMediaManifest, storedSupplierMedia } from "../app/lib/supplier-media-store.ts";
import { archiveNewSupplierMediaCandidate } from "../app/lib/supplier-media-candidate-archive.ts";
import { runSupplierMediaBackfill, supplierMediaBackfillStateKey, supplierMediaReadyKey } from "../app/lib/supplier-media-backfill.ts";
import { catalogReferencesSupplierMedia, recoverSupplierMedia } from "../app/lib/supplier-media-recovery.ts";
import { projectSpaViiSite } from "../app/lib/spa-editorial-policy.ts";

const jpeg = new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1,2,3,255,217]);
const source = "https://www.spaplus.co.il/gallery/1683553054234250.jpeg";

function clone(bytes) { return new Uint8Array(bytes); }
function bucket() {
  const objects = new Map();
  return {
    objects,
    async head(key) {
      const row = objects.get(key);
      return row ? { size: row.bytes.byteLength, httpMetadata: row.httpMetadata, customMetadata: row.customMetadata } : null;
    },
    async get(key) {
      const row = objects.get(key);
      if (!row) return null;
      const value = clone(row.bytes);
      return {
        size: value.byteLength,
        body: new Response(value).body,
        httpMetadata: row.httpMetadata,
        customMetadata: row.customMetadata,
        text: async () => new TextDecoder().decode(value),
      };
    },
    async put(key, value, options = {}) {
      if (options.onlyIf?.etagDoesNotMatch === "*" && objects.has(key)) return null;
      const bytes = typeof value === "string" ? new TextEncoder().encode(value)
        : value instanceof Uint8Array ? clone(value)
          : new Uint8Array(await new Response(value).arrayBuffer());
      objects.set(key, { bytes, httpMetadata: options.httpMetadata || {}, customMetadata: options.customMetadata || {} });
      return { key };
    },
  };
}

function imageResponse(body = jpeg) {
  return new Response(body, { status: 200, headers: { "content-type": "image/jpeg", "content-length": String(body.byteLength) } });
}

test("supplier media identity is strict, stable and reversible", () => {
  const token = supplierMediaToken(source);
  assert.ok(token);
  assert.equal(supplierMediaSourceFromToken(token), source);
  assert.equal(localSupplierMediaUrl(source), `/api/vii/supplier-media/${token}`);
  assert.equal(supplierMediaSource(`/api/vii/supplier-media/${token}`), source);
  assert.equal(canonicalSupplierMediaSource("http://www.spaplus.co.il/gallery/x.jpg"), null);
  assert.equal(canonicalSupplierMediaSource("https://evil.test/gallery/x.jpg"), null);
  assert.equal(canonicalSupplierMediaSource("https://www.spaplus.co.il/other/x.jpg"), null);
  assert.equal(canonicalSupplierMediaSource("https://www.spaplus.co.il/gallery/1773307880052130.jpeg"), null);
});

test("archive writes a content-addressed blob and a verified source manifest", async () => {
  const storage = bucket();
  let fetches = 0;
  const receipt = await archiveSupplierMedia(source, storage, async url => { fetches++; assert.equal(url, source); return imageResponse(); });
  assert.equal(receipt.skipped, false);
  assert.match(receipt.sha256, /^[a-f0-9]{64}$/);
  assert.match(receipt.blobKey, new RegExp(receipt.sha256));
  const manifest = await readSupplierMediaManifest(storage, receipt.token);
  assert.equal(manifest.sourceUrl, source);
  assert.equal(manifest.sha256, receipt.sha256);
  const stored = await storedSupplierMedia(storage, receipt.token);
  assert.deepEqual(new Uint8Array(await new Response(stored.object.body).arrayBuffer()), jpeg);
  const repeated = await archiveSupplierMedia(source, storage, async () => { throw Error("unexpected_fetch"); });
  assert.equal(repeated.skipped, true);
  assert.equal(fetches, 1);
});

test("archive fails closed for redirects, non-images and unapproved origins", async () => {
  await assert.rejects(() => archiveSupplierMedia("https://evil.test/x.jpg", bucket(), async () => imageResponse()), /source_not_allowed/);
  await assert.rejects(() => archiveSupplierMedia(source, bucket(), async () => new Response(null, { status: 302, headers: { location: "https://evil.test" } })), /redirect_not_allowed/);
  await assert.rejects(() => archiveSupplierMedia(source, bucket(), async () => new Response("html", { headers: { "content-type": "text/html" } })), /type_invalid/);
});

test("new supplier media must archive before candidate acceptance", async () => {
  const storage = bucket();
  const previous = { summary: { image: source } };
  const candidate = { summary: { image: source, gallery: [source, "https://www.spaplus.co.il/gallery/next.jpeg"] } };
  const result = await archiveNewSupplierMediaCandidate({ previous, candidate, bucket: storage, fetchImpl: async () => imageResponse() });
  assert.equal(result.introduced, 1);
  assert.equal(result.archived.length, 1);
  await assert.rejects(() => archiveNewSupplierMediaCandidate({ previous, candidate, bucket: bucket(), fetchImpl: async () => new Response(null, { status: 404 }) }), /http_404/);
});

test("SpaPlus public projection emits same-origin media for site, gallery and packages", async () => {
  const sourceSite = spa.sites.find(site => site.image && site.packages?.some(pack => pack.image));
  const raw = sourceSite && { ...sourceSite, gallery: [sourceSite.image, sourceSite.packages.find(pack => pack.image).image] };
  assert.ok(raw);
  const projected = await projectSpaViiSite(raw);
  assert.match(projected.image, /^\/api\/vii\/supplier-media\//);
  assert.ok(projected.gallery.every(image => image.startsWith("/api/vii/supplier-media/")));
  assert.ok(projected.packages.filter(pack => pack.image).every(pack => pack.image.startsWith("/api/vii/supplier-media/")));
  assert.deepEqual(projected.gallery.map(supplierMediaSource), raw.gallery.map(supplierMediaSource));
});

test("complete bundled spa projection has no direct supplier gallery URL", async () => {
  const projected = await Promise.all(spa.sites.map(projectSpaViiSite));
  const serialized = JSON.stringify(projected);
  assert.doesNotMatch(serialized, /https:\/\/www\.spaplus\.co\.il\/gallery\//);
  assert.match(serialized, /\/api\/vii\/supplier-media\//);
});

test("bounded backfill persists cursor, resumes and writes a ready marker", async () => {
  const storage = bucket();
  const entries = [{ summary: { image: source, gallery: ["https://www.spaplus.co.il/gallery/next.jpeg"] } }];
  const first = await runSupplierMediaBackfill(entries, storage, { limit: 1, fetchImpl: async () => imageResponse() });
  assert.equal(first.status, "running");
  assert.equal(first.cursor, 1);
  assert.ok(storage.objects.has(supplierMediaBackfillStateKey));
  const second = await runSupplierMediaBackfill(entries, storage, { limit: 1, fetchImpl: async () => imageResponse() });
  assert.equal(second.status, "complete");
  assert.equal(second.cursor, 2);
  assert.ok(storage.objects.has(supplierMediaReadyKey));
});

test("one bad source is recorded without preventing the rest of the inventory from archiving", async () => {
  const storage = bucket();
  const next = "https://www.spaplus.co.il/gallery/next.jpeg";
  const entries = [{ summary: { gallery: [source, next] } }];
  const first = await runSupplierMediaBackfill(entries, storage, {
    limit: 1,
    fetchImpl: async (url) => url === source ? new Response(null, { status: 404 }) : imageResponse(),
  });
  assert.equal(first.status, "running");
  assert.equal(first.cursor, 1);
  assert.equal(first.failures.length, 1);
  const second = await runSupplierMediaBackfill(entries, storage, { limit: 1, fetchImpl: async () => imageResponse() });
  assert.equal(second.status, "blocked");
  assert.equal(second.cursor, 2);
  assert.equal(second.failures.length, 1);
  const retried = await runSupplierMediaBackfill(entries, storage, {
    limit: 1,
    retryBlocked: true,
    fetchImpl: async () => imageResponse(),
  });
  assert.equal(retried.status, "complete");
  assert.equal(retried.failures.length, 0);
  assert.ok(storage.objects.has(supplierMediaReadyKey));
});

test("lazy recovery is limited to catalog-approved media and persists once", async () => {
  const storage = bucket();
  const token = supplierMediaToken(source);
  assert.equal(await catalogReferencesSupplierMedia(undefined, token), true);
  let fetches = 0;
  assert.equal(await recoverSupplierMedia(token, { UPLOADS: storage }, async () => { fetches++; return imageResponse(); }), true);
  assert.equal(await recoverSupplierMedia(token, { UPLOADS: storage }, async () => { throw Error("unexpected_fetch"); }), true);
  assert.equal(fetches, 1);
  const unknown = supplierMediaToken("https://www.spaplus.co.il/gallery/unknown-never-published.jpeg");
  assert.equal(await recoverSupplierMedia(unknown, { UPLOADS: storage }, async () => imageResponse()), false);
});

