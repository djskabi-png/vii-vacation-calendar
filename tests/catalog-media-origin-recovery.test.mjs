import assert from "node:assert/strict";
import { test } from "node:test";
import { sourceImageMagic } from "../app/lib/catalog-media-origin-recovery.ts";

test("catalog origin recovery accepts only matching raster signatures", () => {
  assert.equal(sourceImageMagic(Uint8Array.from([255,216,255,0,0,0,0,0,0,0,0,0]), "image/jpeg"), true);
  assert.equal(sourceImageMagic(Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]), "image/png"), true);
  assert.equal(sourceImageMagic(new TextEncoder().encode("<html>not image"), "image/jpeg"), false);
  assert.equal(sourceImageMagic(new Uint8Array(12), "image/png"), false);
});
