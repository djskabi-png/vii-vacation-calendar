import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const css = readEffectiveWorldCss();

test("mobile business details place bookable units before the long facilities inventory", () => {
  assert.ok(source.indexOf('id="rooms"') < source.indexOf('id="features"'));
  assert.match(source, /<UnifiedAmenityList items=\{propertyAmenities\} \/>/);
  assert.doesNotMatch(source, /feature-section__mobile-preview|mobileFeaturesOpen|mobile-feature-groups/);
});

test("mobile facilities use one shared unboxed progressive disclosure", () => {
  assert.match(css, /\.unified-amenities__list\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*\.unified-amenities__list\s*\{\s*grid-template-columns:\s*1fr;/s);
  assert.match(css, /\.unified-amenities__toggle:focus-visible/);
  assert.doesNotMatch(css, /\.unified-amenities__list li\s*\{[^}]*border:/s);
});
