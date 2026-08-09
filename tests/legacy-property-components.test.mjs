import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = await readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("property data contract supports five CMS-selected highlights and grouped amenities", () => {
  const listingType = data.slice(data.indexOf("export type Listing ="), data.indexOf("export type BusinessWorld"));
  assert.match(listingType, /highlights\?: ListingHighlight\[\]/);
  assert.match(listingType, /featureGroups\?: ListingFeatureGroup\[\]/);
  assert.match(data, /export type ListingHighlightIcon/);
  assert.match(page, /\.slice\(0, 5\)/);
});

test("property page preserves description, highlights and full feature groups as separate components", () => {
  assert.match(page, /תיאור מקום האירוח/);
  assert.match(page, /aria-label="הדברים הבולטים במקום"/);
  assert.match(page, /property-feature-groups/);
  assert.match(page, /modal-feature-groups/);
  assert.match(page, /property\.featureGroups\?\.length/);
});

test("highlight strip is a five-column desktop row and a safe mobile scroller", () => {
  assert.match(css, /\.property-highlights \{ display: grid; grid-template-columns: repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-auto-columns: 132px/);
  assert.match(css, /scroll-snap-type: inline mandatory/);
  assert.match(css, /\.property-feature-groups \{ grid-template-columns: 1fr; \}/);
});
