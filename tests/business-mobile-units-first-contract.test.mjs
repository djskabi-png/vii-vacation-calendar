import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("mobile business details place bookable units before the long facilities inventory", () => {
  assert.ok(source.indexOf('id="rooms"') < source.indexOf('id="features"'));
  assert.match(source, /feature-section__mobile-preview/);
  assert.match(source, /className="feature-section__mobile-toggle"/);
  assert.match(source, /aria-expanded=\{mobileFeaturesOpen\}/);
  assert.match(source, /aria-controls="mobile-feature-groups"/);
  assert.match(source, /hidden=\{!mobileFeaturesOpen\}/);
  assert.match(source, /feature-section__mobile-groups[\s\S]*featureGroups\.map/);
});

test("mobile facilities use progressive disclosure while desktop keeps the complete groups", () => {
  assert.match(css, /\.feature-section__mobile-preview,\s*\.feature-section__mobile-details\s*\{\s*display:\s*none;/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*\.feature-section__mobile-preview\s*\{\s*display:\s*grid;/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*\.feature-section__mobile-details\s*\{\s*display:\s*block;/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*\.feature-section\s*>\s*\.property-feature-groups,[\s\S]*\.feature-section__desktop-more\s*\{\s*display:\s*none;/);
  assert.match(css, /\.feature-section__mobile-toggle:focus-visible/);
});
