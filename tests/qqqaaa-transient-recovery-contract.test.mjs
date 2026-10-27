import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("QQQAAA production audits use one bounded recovery and still require settled UI", async () => {
  const [seo, map, overlay] = await Promise.all([
    read("scripts/audit-public-seo.mjs"),
    read("scripts/audit-map-experience.cjs"),
    read("scripts/audit-overlay-geometry.cjs"),
  ]);

  assert.match(seo, /attempt <= 2/);
  assert.match(seo, /TimeoutError/);
  assert.match(map, /const rotated = await waitForStableMap\(page\)/);
  assert.match(map, /const restored = await waitForStableMap\(page\)/);
  assert.match(overlay, /const locationReady = await locationButton\.waitFor/);
  assert.match(overlay, /settledSummary\.click\(\{ force: true \}\)/);
});
