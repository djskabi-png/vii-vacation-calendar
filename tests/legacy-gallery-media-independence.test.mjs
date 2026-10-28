import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const manifest = JSON.parse(await read("app/data/legacy-gallery-media.json"));

test("every migrated legacy gallery object has one safe immutable identity", () => {
  assert.equal(manifest.files.length, 36_535);
  assert.equal(new Set(manifest.files).size, manifest.files.length);
  assert.equal(manifest.objectPrefix, "legacy-gallery/v1/");
  for (const filename of manifest.files) {
    assert.match(filename, /^[A-Za-z0-9._-]+\.(?:avif|gif|jfif|jpe?g|png|webp)$/i);
  }
});

test("public catalog artifacts no longer render gallery media from the retiring site", async () => {
  for (const path of [
    "app/data/accepted-runtime-catalog-state.json",
    "app/data/sergey-hourly-catalog.json",
    "app/data/sergey-place-details.json",
    "app/data/sergey-public-catalog.json",
  ]) {
    const document = JSON.parse(await read(path));
    const visit = (value, key = "", mediaValue = false) => {
      if (typeof value === "string" && mediaValue) {
        assert.doesNotMatch(value, /^https?:\/\/(?:www\.)?vii\.co\.il\/gallery\//i, `${path}:${key}`);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${key}[${index}]`, mediaValue));
      } else if (value && typeof value === "object") {
        Object.entries(value).forEach(([childKey, item]) => visit(item, key ? `${key}.${childKey}` : childKey, /^(?:image|images)$/.test(childKey)));
      }
    };
    visit(document);
  }
});

test("supplier refreshes normalize source gallery media to the local immutable route", async () => {
  for (const path of [
    "app/lib/sergey-gallery.ts",
    "app/lib/sergey-rooms-catalog-client.ts",
    "app/lib/sergey-vii-api.ts",
    "app/lib/vii-home-deals.ts",
    "scripts/build-sergey-public-catalog.mjs",
  ]) {
    const source = await read(path);
    assert.match(source, /localGalleryMediaUrl/, path);
  }
});

test("local media normalization is idempotent for accepted catalog snapshots", async () => {
  const { localGalleryMediaUrl } = await import("../app/lib/legacy-gallery-media.ts");
  assert.equal(localGalleryMediaUrl("/gallery/example.jpg"), "/api/vii/media/example.jpg");
  assert.equal(localGalleryMediaUrl("/api/vii/media/example.jpg"), "/api/vii/media/example.jpg");
  assert.equal(localGalleryMediaUrl("https://untrusted.example/example.jpg"), null);
});

test("the bounded migration route is allowlisted, stored in R2 and exposes storage verification", async () => {
  const route = await read("app/api/vii/media/[filename]/route.ts");
  assert.match(route, /new Set<string>\(manifest\.files\)/);
  assert.match(route, /files\.has\(filename\)/);
  assert.match(route, /legacyGalleryBucket/);
  assert.match(route, /export async function HEAD/);
  assert.match(route, /X-VII-Media/);
  assert.match(route, /contentType\.startsWith\("image\/"\)/);
  assert.match(route, /20_000_000/);
  assert.match(route, /const ALLOW_LEGACY_ORIGIN_FETCH = true/);
});

test("availability and facility rendering no longer request the retiring site", async () => {
  for (const path of ["app/api/legacy-availability/route.ts", "app/lib/live-business-amenities.ts"]) {
    const source = await read(path);
    assert.doesNotMatch(source, /fetch\([^\n]*(?:www\.)?vii\.co\.il/i, path);
  }
});
