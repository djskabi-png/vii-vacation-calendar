import assert from "node:assert/strict";
import jpeg from "jpeg-js";
import { transformResponsiveImage } from "../worker/responsive-image-transform";

const sourceUrl = process.argv[2]
  || "https://vii.spaplus.co/api/vii/media/5962a5b1c42c285.jpeg";
const source = await fetch(sourceUrl);
assert.equal(source.ok, true, `source image returned ${source.status}`);
const sourceBytes = new Uint8Array(await source.arrayBuffer());

const transformed = await transformResponsiveImage(
  new Blob([sourceBytes]).stream(),
  { width: 384, format: "image/webp", quality: 75 },
);
const outputBytes = new Uint8Array(await transformed.arrayBuffer());
const output = jpeg.decode(outputBytes, { useTArray: true, formatAsRGBA: true });
assert.equal(transformed.headers.get("content-type"), "image/jpeg");
assert.equal(transformed.headers.get("x-vii-image-engine"), "jpeg-js");
assert.equal(output.width, 384);
const evidence = {
  sourceBytes: sourceBytes.byteLength,
  outputBytes: outputBytes.byteLength,
  width: output.width,
  height: output.height,
  engine: transformed.headers.get("x-vii-image-engine"),
};
console.log(JSON.stringify(evidence));
assert.ok(outputBytes.byteLength < sourceBytes.byteLength, "optimized image must be smaller than the source");
