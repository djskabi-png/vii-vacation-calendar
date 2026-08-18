import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import test from "node:test";

const providerMediaDirectory = resolve("public/media/providers");
const maximumProviderImageBytes = 1_500 * 1024;
const maximumJpegDimension = 3200;

function jpegDimensions(buffer) {
  assert.equal(buffer[0], 0xff, "JPEG must begin with an SOI marker");
  assert.equal(buffer[1], 0xd8, "JPEG must begin with an SOI marker");
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const length = buffer.readUInt16BE(offset);
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  throw new Error("JPEG dimensions were not found");
}

test("provider gallery images stay inside the delivery budget", async () => {
  const names = await readdir(providerMediaDirectory);
  const imageNames = names.filter((name) => /\.(?:jpe?g|png|webp)$/i.test(name));
  assert.ok(imageNames.length > 0, "Provider media inventory must not be empty");

  for (const name of imageNames) {
    const path = resolve(providerMediaDirectory, name);
    const file = await stat(path);
    assert.ok(
      file.size <= maximumProviderImageBytes,
      `${name} is ${(file.size / 1024).toFixed(1)} KB; provider images must stay at or below 1500 KB`,
    );

    if (/\.jpe?g$/i.test(extname(name))) {
      const { width, height } = jpegDimensions(await readFile(path));
      assert.ok(
        Math.max(width, height) <= maximumJpegDimension,
        `${name} is ${width}x${height}; JPEG provider images must stay at or below 3200 px on the longest edge`,
      );
    }
  }
});
