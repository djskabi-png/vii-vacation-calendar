import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const css = await readEffectiveWorldCss();
const business = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");

test("desktop amenities use one clean two-column list without nested cards", () => {
  assert.match(business, /<UnifiedAmenityList items=\{propertyAmenities\} \/>/);
  assert.doesNotMatch(business, /balanceFeatureGroups|property-feature-groups__column/);
  assert.match(css, /\.unified-amenities__list\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/s);
  assert.doesNotMatch(css, /\.unified-amenities__list li\s*\{[^}]*border:/s);
});

test("narrow layouts collapse the shared amenity list to one column", () => {
  assert.match(css, /@media[^{}]*max-width:[^{}]*\{[\s\S]*?\.unified-amenities__list\s*\{\s*grid-template-columns:\s*1fr;/s);
  assert.match(css, /\.unified-amenities__toggle\s*\{[^}]*width:\s*100%/s);
});
