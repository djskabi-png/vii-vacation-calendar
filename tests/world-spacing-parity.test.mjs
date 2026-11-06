import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readEffectiveWorldCss();

test("shared site sections use the approved vacation spacing rhythm", () => {
  assert.match(css, /\.section \{ padding-block: 64px; \}/);
  assert.match(css, /\.section-head \{[^}]*margin-bottom: 24px;/);
  assert.doesNotMatch(css, /\.section \{ padding-block: 86px; \}/);
});

test("shared mobile sections match the compact vacation rhythm", () => {
  const mobile = css.match(/@media \(max-width: 820px\) \{[\s\S]*?\.section \{ padding-block: 48px; \}/);
  assert.ok(mobile, "expected the shared 48px mobile section rhythm");
  assert.doesNotMatch(css, /\.section \{ padding-block: 60px; \}/);
});

test("world and event landings cannot reintroduce larger spacing than vacation", () => {
  assert.match(css, /\.world-page > \.section,\s*\.events-page > \.section \{ padding-block: 64px; \}/);
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.world-page > \.section,\s*\.events-page > \.section \{ padding-block: 48px; \}/);
  assert.match(css, /\.discovery-world-hero:has\(\.discovery-world-hero__search\)\+\.section \{ padding-top:64px; \}/);
  assert.match(css, /\.spa-discovery-hero \+ \.section \{ padding-top: 64px; \}/);
  assert.match(css, /\.trails-page > \.trail-explorer,\s*\.attractions-page > \.attraction-explorer \{ padding: 10px 0 64px; \}/);
});
