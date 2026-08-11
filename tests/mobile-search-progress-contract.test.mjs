import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("mobile search opens as one complete editor instead of forcing a location step", () => {
  assert.match(source, /setMobileStep\("overview"\); setMobileExpanded\(true\); setLocationOpen\(false\);/);
  assert.doesNotMatch(source, /className="search-mobile-progress"/);
  assert.match(css, /\.search-box-shell\.mobile-expanded \.search-step:not\(\.active\) \{ display: block; \}/);
});

test("mobile search action remains reachable in every edit state", () => {
  assert.match(css, /\.search-box-shell\.mobile-expanded \.search-submit,[\s\S]*?mobile-step-overview \.search-submit \{ display: flex; \}/);
  assert.match(css, /\.search-box-shell\.mobile-expanded \.location-list \{[\s\S]*?position: static;[\s\S]*?max-height: none;[\s\S]*?overflow: visible;/);
});