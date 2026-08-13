import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the expanded mobile search owns the top stacking layer", () => {
  assert.match(css, /\.home-hero:has\(\.search-box-shell\.mobile-expanded\),[\s\S]*?\.sticky-property-search:has\(\.search-box-shell\.mobile-expanded\) \{ position: relative; z-index: 1600; \}/);
  assert.match(css, /\.search-box-shell\.mobile-expanded \{ z-index: 1600; isolation: isolate; \}/);
});
