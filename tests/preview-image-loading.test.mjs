import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/lib/preview-image-loader.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { createPreviewImageLoader, findReadyPreviewImage } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function fixture() {
  const images = [];
  const loader = createPreviewImageLoader(() => {
    const image = { onload: null, onerror: null, naturalWidth: 0, src: "", decode: () => Promise.resolve(), removeAttribute() { this.src = ""; } };
    images.push(image);
    return image;
  });
  const succeed = async (image) => { image.naturalWidth = 800; image.onload?.(); await Promise.resolve(); await Promise.resolve(); };
  const drain = async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const active = images.filter(i => i.onload);
      if (!active.length) return;
      for (const image of active) await succeed(image);
    }
    assert.fail("loader did not drain");
  };
  return { loader, images, succeed, drain };
}

test("loader does not eagerly create any images and deduplicates concurrent requests", async () => {
  const f = fixture();
  assert.equal(f.images.length, 0);
  const first = f.loader.load("one");
  assert.equal(f.loader.load("one"), first);
  assert.equal(f.images.length, 1);
  await f.succeed(f.images[0]);
  assert.equal(await first, true);
  assert.equal(await f.loader.load("one"), true);
  assert.equal(f.images.length, 1);
});

test("only two image requests run at once and direct clicks overtake queued warming", async () => {
  const f = fixture();
  const requests = [f.loader.load("a"), f.loader.load("b"), f.loader.load("warm", false), f.loader.load("clicked")];
  assert.equal(f.images.length, 2);
  await f.succeed(f.images[0]);
  assert.equal(f.images[2].src, "clicked");
  await f.drain();
  assert.deepEqual(await Promise.all(requests), [true, true, true, true]);
});

test("an image is ready only after decoding completes", async () => {
  const f = fixture();
  const loaded = f.loader.load("decode");
  let release;
  f.images[0].decode = () => new Promise(resolve => { release = resolve; });
  f.images[0].naturalWidth = 800;
  f.images[0].onload();
  let settled = false;
  void loaded.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  release();
  assert.equal(await loaded, true);
});

test("failed image requests are not cached and may be retried", async () => {
  const f = fixture();
  const first = f.loader.load("retry");
  f.images[0].onerror();
  assert.equal(await first, false);
  assert.equal(f.images[0].src, "");
  const second = f.loader.load("retry");
  assert.equal(f.images.length, 2);
  await f.succeed(f.images[1]);
  assert.equal(await second, true);
});

test("gallery skips consecutive broken supplier URLs and selects the first decodable photo", async () => {
  const attempts = [];
  const readyIndex = await findReadyPreviewImage(["stale-html-1", "stale-html-2", "valid-photo", "unused"], 0, 1, async src => {
    attempts.push(src);
    return src === "valid-photo";
  });
  assert.equal(readyIndex, 2);
  assert.deepEqual(attempts, ["stale-html-1", "stale-html-2", "valid-photo"]);
});

test("gallery reports exhaustion only after every remaining supplier URL fails", async () => {
  const attempts = [];
  const readyIndex = await findReadyPreviewImage(["shown", "broken-1", "broken-2"], 1, 1, async src => {
    attempts.push(src);
    return false;
  });
  assert.equal(readyIndex, null);
  assert.deepEqual(attempts, ["broken-1", "broken-2"]);
});

test("decode failure is recoverable and never reported ready", async () => {
  const f = fixture();
  const first = f.loader.load("bad-decode");
  f.images[0].decode = () => Promise.reject(new Error("decode failed"));
  await f.succeed(f.images[0]);
  assert.equal(await first, false);
  assert.equal(f.images[0].src, "");
});

test("speculative queue is bounded and discarded promises settle", async () => {
  const f = fixture();
  const requests = Array.from({ length: 20 }, (_, i) => f.loader.load(`photo-${i}`, false));
  assert.equal(f.images.length, 2);
  assert.equal(await requests[19], false);
  await f.drain();
  const results = await Promise.all(requests);
  assert.equal(results.filter(Boolean).length, 10);
  assert.equal(f.images.length, 10);
});

test("decoded cache has a bounded LRU of48 entries", async () => {
  const f = fixture();
  for (let i = 0; i < 49; i++) {
    const promise = f.loader.load(`photo-${i}`);
    await f.succeed(f.images.at(-1));
    assert.equal(await promise, true);
  }
  assert.equal(await f.loader.load("photo-48"), true);
  assert.equal(f.images.length, 49);
  const evicted = f.loader.load("photo-0");
  assert.equal(f.images.length, 50);
  await f.succeed(f.images.at(-1));
  assert.equal(await evicted, true);
});

test("both card families retain displayed index until success with latest-request and unmount guards", () => {
  const hook = fs.readFileSync(new URL("../app/components/use-preview-gallery.tsx", import.meta.url), "utf8");
  assert.match(hook, /findReadyPreviewImage\(imagesRef\.current, target, direction\)/);
  assert.match(hook, /index: readyIndex \?\? imageIndex/);
  assert.match(hook, /token !== request\.current/);
  assert.match(hook, /!alive\.current/);
  assert.match(hook, /connection\?\.saveData/);
  assert.match(hook, /state\.key === imageKey \? state\.index : 0/);
  for (const name of ["property-card", "preview-card-gallery"]) {
    const card = fs.readFileSync(new URL(`../app/components/${name}.tsx`, import.meta.url), "utf8");
    assert.match(card, /usePreviewGallery\(galleryImages\)/);
    assert.match(card, /PreviewGalleryStatus pending=\{pending\} error=\{error\}/);
    assert.match(card, /aria-busy=\{pending \|\| undefined\}/);
  }
});
