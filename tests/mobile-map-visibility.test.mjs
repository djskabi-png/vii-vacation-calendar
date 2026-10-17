import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const guard = fs.readFileSync(new URL("../app/components/responsive-viewport-guard.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("mobile map FAB visibility follows the results region and preserves active maps", () => {
  assert.match(guard, /data-map-results-visible/);
  assert.match(guard, /IntersectionObserver/);
  assert.match(guard, /MutationObserver/);
  assert.match(guard, /threshold: 0/);
  assert.match(guard, /\.results-list, \.trail-explorer/);
  assert.match(guard, /\.attraction-explorer, \.world-map-results/);
  assert.match(guard, /observer\.unobserve\(region\)/);
  assert.match(css, /body:not\(\[data-map-results-visible\]\) \.mobile-map-fab:not\(\.active\)/);
});

test("regional availability cards never have the normal-results map FAB covering them", () => {
  assert.match(guard, /visible.size > 0 && availabilityVisible.size === 0/);
  assert.match(guard, /region.matches\("\.regional-availability"\)/);
  assert.match(guard, /querySelectorAll<HTMLElement>\("\.regional-availability"\)/);
  assert.match(guard, /availabilityVisible.delete\(region\)/);
});
