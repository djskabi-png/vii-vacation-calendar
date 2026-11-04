import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the image optimizer never decodes or buffers photography inside the Worker", async () => {
  const source = await read("worker/responsive-image-transform.ts");
  assert.doesNotMatch(source, /jpeg-js/);
  assert.doesNotMatch(source, /jpeg\.decode/);
  assert.doesNotMatch(source, /arrayBuffer\(\)/);
  assert.doesNotMatch(source, /new Blob/);
  assert.match(source, /nativeBinding\s*\.input\(body\)/s);
  assert.match(source, /X-VII-Image-Engine/);
  assert.match(source, /Native image transform binding is unavailable/);
});

test("the worker treats the managed images binding as optional", async () => {
  const worker = await read("worker/index.ts");
  assert.match(worker, /IMAGES\?: NativeImageBinding/);
  assert.match(worker, /transformResponsiveImage\(body, options, env\.IMAGES\)/);
});
