import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dock = fs.readFileSync(new URL("../app/components/detail-sticky-dock.tsx", import.meta.url), "utf8");
const business = fs.readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const events = fs.readFileSync(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("sticky detail dock never repeats the place name and location", () => {
  assert.doesNotMatch(dock, /detail-sticky-dock__identity/);
  assert.doesNotMatch(dock, /<strong>\{name\}<\/strong>/);
});

test("review summary is rendered only from a real rating and a positive review count", () => {
  assert.match(dock, /typeof rating === "number"/);
  assert.match(dock, /typeof reviewCount === "number"/);
  assert.match(dock, /reviewCount > 0/);
  assert.match(dock, /export function DetailReviewSummary/);
  assert.match(dock, /if \(!hasReviewSummary\) return null/);
  assert.match(dock, /detail-sticky-dock__stars[^>]*>★★★★★<\/span>/);
  assert.doesNotMatch(dock, /<small>\{outOfTenLabel\}<\/small>/);
});

test("business and event pages use the same verified values as their review section", () => {
  assert.match(business, /rating=\{supplierDetail\?\.reviewScore \?\? property\.score\}/);
  assert.match(business, /reviewCount=\{supplierDetail\?\.reviewCount \?\? property\.reviews\}/);
  assert.match(events, /rating=\{supplierDetail\?\.reviewScore \?\? place\.score\}/);
  assert.match(events, /reviewCount=\{supplierDetail\?\.reviewCount \?\? place\.reviews\}/);
});

test("mobile rating strip is placed directly after each rated gallery and stays hidden on desktop", () => {
  assert.match(business, /<\/div>\s*<DetailReviewSummary\s+className="shell detail-mobile-review-summary"/);
  assert.match(events, /onOpen=\{\(index\) => openGallery\("all", index\)\} \/>\s*<DetailReviewSummary\s+className="shell detail-mobile-review-summary"/);
  assert.match(css, /\.detail-mobile-review-summary \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.detail-sticky-dock__review-summary\.detail-mobile-review-summary \{[\s\S]*?display: flex;/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.detail-sticky-wrap \{ display: none; \}/);
});

test("business about section does not repeat the place name below the gallery", () => {
  assert.match(business, /className="property-about"><h2>\{translate\("על המקום"\)\}<\/h2>/);
  assert.doesNotMatch(business, /className="property-about"><h2>\{translate\("על"\)\} \{localizedPropertyName\}<\/h2>/);
});
