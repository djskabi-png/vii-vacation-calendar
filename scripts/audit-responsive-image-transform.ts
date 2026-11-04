import assert from "node:assert/strict";
import { transformResponsiveImage } from "../worker/responsive-image-transform";

const sourceBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
let receivedOriginalStream = false;
const binding = {
  input(stream: ReadableStream) {
    receivedOriginalStream = stream instanceof ReadableStream;
    return {
      transform(options: Record<string, unknown>) {
        assert.deepEqual(options, { width: 384 });
        return {
          async output(options: { format: string; quality: number }) {
            assert.deepEqual(options, { format: "image/webp", quality: 75 });
            return {
              response() {
                return new Response(sourceBytes, { headers: { "Content-Type": "image/webp" } });
              },
            };
          },
        };
      },
    };
  },
};

const transformed = await transformResponsiveImage(
  new Blob([sourceBytes]).stream(),
  { width: 384, format: "image/webp", quality: 75 },
  binding,
);
assert.equal(receivedOriginalStream, true);
assert.equal(transformed.headers.get("content-type"), "image/webp");
assert.equal(transformed.headers.get("x-vii-image-engine"), "cloudflare-images");
assert.deepEqual(new Uint8Array(await transformed.arrayBuffer()), sourceBytes);

await assert.rejects(
  () => transformResponsiveImage(new Blob([sourceBytes]).stream(), { width: 384, format: "image/webp", quality: 75 }),
  /Native image transform binding is unavailable/,
);

console.log(JSON.stringify({ engine: transformed.headers.get("x-vii-image-engine"), streamed: receivedOriginalStream }));
