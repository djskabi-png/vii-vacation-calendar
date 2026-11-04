import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { cardImageWidths, isOptimizableCardMedia, optimizedCardMediaUrl, responsiveCardMedia } from "../app/lib/responsive-media.ts";
import { localGalleryFilename, optimizedMediaSource } from "../worker/optimized-media-source.ts";

test("responsive card media is limited to safe local VII gallery files", () => {
  assert.equal(isOptimizableCardMedia("/api/vii/media/6864e3232a91160.jpg"), true);
  for (const unsafe of [
    "https://example.com/photo.jpg",
    "/api/vii/media/../secret.jpg",
    "/api/vii/media/%2e%2e%2fsecret.jpg",
    "/api/vii/media/nested/photo.jpg",
    "/api/vii/media/photo.svg",
    "/api/vii/media/photo.jpg?version=2",
  ]) assert.equal(isOptimizableCardMedia(unsafe), false, unsafe);
  assert.deepEqual(cardImageWidths, [384, 640, 750, 828]);
  assert.equal(optimizedCardMediaUrl("/api/vii/media/photo.jpg", 640), "/_vinext/image?url=%2Fapi%2Fvii%2Fmedia%2Fphoto.jpg&w=640&q=82");
  const responsive = responsiveCardMedia("/api/vii/media/photo.jpg");
  for (const width of cardImageWidths) assert.match(responsive.srcSet || "", new RegExp(`&w=${width}&q=82 ${width}w`));
});

test("worker optimizer source reads only the bounded gallery R2 prefix", async () => {
  const requested = [];
  const bucket = {
    async get(key) {
      requested.push(key);
      if (key !== "legacy-gallery/v1/photo.jpg") return null;
      return {
        body: new Blob(["image-bytes"]).stream(),
        httpEtag: '"etag-photo"',
        httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" },
      };
    },
  };
  const response = await optimizedMediaSource("/api/vii/media/photo.jpg", bucket);
  assert.equal(response?.status, 200);
  assert.equal(response?.headers.get("content-type"), "image/jpeg");
  assert.equal(response?.headers.get("x-vii-media"), "stored");
  assert.deepEqual(requested, ["legacy-gallery/v1/photo.jpg"]);

  for (const unsafe of [
    "/api/vii/media/../secret.jpg",
    "/api/vii/media/%2e%2e%2fsecret.jpg",
    "/api/vii/media/nested/photo.jpg",
    "/api/vii/media/photo.svg",
    "/api/vii/media/photo.jpg?x=1",
    "/private/photo.jpg",
  ]) {
    assert.equal(localGalleryFilename(unsafe), null, unsafe);
    assert.equal(await optimizedMediaSource(unsafe, bucket), null, unsafe);
  }
  assert.equal(requested.length, 1);
});
test("verified native service retains the exact photo identity at card and full gallery widths", () => {
  const src='/api/vii/media/5367d7dbf7eb447.jpeg';
  const card=responsiveCardMedia(src);
  assert.equal(new URL(card.src).origin,'https://vii-public-images.djskabi.workers.dev');
  assert.equal(new URL(card.src).searchParams.get('url'),src);
  assert.equal(new URL(card.src).searchParams.get('q'),'82');
  const hero=responsiveCardMedia(src,88,[640,960,1280,1600]);
  for(const width of [640,960,1280,1600])assert.ok(hero.srcSet.includes(`&w=${width}&q=88 ${width}w`));
  assert.equal(new URL(hero.src).searchParams.get('url'),src);
});

test("shared cards use responsive sources, original recovery and bounded priority", async () => {
  const [component, preview, property, search, worker, loading] = await Promise.all([
    readFile(new URL("../app/components/responsive-card-image.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/preview-card-gallery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/property-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/loading.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(component, /setFailedOptimizedSource\(src\)/);
  assert.match(component, /failedOptimizedSource === src/);
  assert.match(component, /src=\{useOriginal \? src : responsive\.src\}/);
  assert.match(component, /srcSet=\{useOriginal \? undefined : responsive\.srcSet\}/);
  assert.match(preview, /<ResponsiveCardImage/);
  assert.match(preview, /onOriginalFailure=/);
  assert.match(property, /<ResponsiveCardImage/);
  assert.match(property, /loading=\{priority \? "eager" : "lazy"\}/);
  assert.match(search, /priority=\{index < 3\}/);
  assert.doesNotMatch(search, /mapActive=.*priority=/);
  assert.match(worker, /optimizedMediaSource\(path, env\.UPLOADS\)/);
  assert.match(loading, /global-route-loading/);
  assert.match(loading, /aria-busy="true"/);
});
