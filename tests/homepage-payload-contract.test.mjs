import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const showcase = readFileSync(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");

test("homepage sends only slider data to its hydrated showcase", () => {
  assert.match(page, /function homeShowcaseProperties\(properties: Property\[\]\)/);
  assert.match(page, /return \[\.\.\.selected\.values\(\)\]\.map\(\(\{ slug, name, location, area, image, videos \}\) =>/);
  assert.doesNotMatch(page, /const showcaseProperties = properties\.map/);
  assert.match(page, /"home-events"\)\.slice\(0, 20\)/);
  assert.doesNotMatch(page, /spaPlaces=|publicCatalogSummaries<SpaPlusSite>/);
  assert.match(showcase, /<SpaPackageDeals \/>/);
  assert.match(page, /<HomeShowcase properties=\{showcaseProperties\} eventPlaces=\{showcaseEvents\}/);
  assert.match(page, /hourlyPlaces=\{showcaseHourly\}/);
  assert.match(showcase, /Pick<Property, "slug" \| "name" \| "location" \| "area" \| "image" \| "videos">\[\]/);
});
