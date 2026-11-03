import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the image optimizer has a bounded independent fallback", async () => {
  const source = await read("worker/responsive-image-transform.ts");
  assert.match(source, /MAX_SOURCE_BYTES/);
  assert.match(source, /MAX_SOURCE_PIXELS/);
  assert.match(source, /jpeg\.decode/);
  assert.match(source, /resizeRgba/);
  assert.match(source, /X-VII-Image-Engine/);
  assert.match(source, /jpegResponse\(bytes, options\)/);
});

test("the worker treats the managed images binding as optional", async () => {
  const worker = await read("worker/index.ts");
  assert.match(worker, /IMAGES\?: NativeImageBinding/);
  assert.match(worker, /transformResponsiveImage\(body, options, env\.IMAGES\)/);
});
