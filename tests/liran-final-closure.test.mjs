import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { bundledPublicCatalogSummaries, bundledPublicSearchCatalogSummaries } from "../app/lib/public-catalog-read.ts";

test("event SSR fallback derives the same semantic search facets before descriptions are sanitized", async () => {
  const [display, search] = await Promise.all([
    bundledPublicCatalogSummaries("events"),
    bundledPublicSearchCatalogSummaries("events"),
  ]);
  assert.equal(search.length, display.length);
  const displayNoise = display.filter((place) => place.features.some((feature) => feature.includes("ללא הגבלת רעש")));
  const searchNoise = search.filter((place) => place.features.some((feature) => feature.includes("ללא הגבלת רעש")));
  assert.ok(searchNoise.length > displayNoise.length, "search facets must be derived from accepted supplier semantics");
  assert.ok(searchNoise.length >= 30, `expected the accepted noise facet family, received ${searchNoise.length}`);
});

test("complete vacation grids use neutral skeletons instead of temporary business cards", async () => {
  const source = await readFile(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
  assert.match(source, /retainedData \|\| layout === "grid" \? \[\] : fallbackProperties\.slice\(0, 3\)/);
  assert.match(source, /displayState === "loading" && !retainedData && !fallbackVisible/);
  assert.match(source, /displayState === "error"\s*\? text\.error/);
  assert.match(source, /home-live-deals__count[^>]*aria-live="polite">\{gridStatusLabel\}/);
});

test("spa refresh without verified data exits skeleton state and keeps a bounded transport", async () => {
  const source = await readFile(new URL("../app/components/spa-package-deals.tsx", import.meta.url), "utf8");
  assert.match(source, /timeoutMs:5_000, totalTimeoutMs:7_000, retries:1/);
  assert.match(source, /return\{key:requestKey,data:previous,status:previous\?"ready":"error"\}/);
  assert.doesNotMatch(source, /status:followup\?"loading"/);
});

test("amenities preserve accepted topic groups and do not promote room facts to the property", async () => {
  const [amenities, business, events, projector] = await Promise.all([
    readFile(new URL("../app/components/unified-amenity-list.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/event-place-detail.ts", import.meta.url), "utf8"),
  ]);
  assert.match(amenities, /unified-amenities__groups/);
  assert.match(amenities, /<h3>\{translate\(group\.title\)\}<\/h3>/);
  assert.match(business, /hasSupplierPropertyAmenities \? supplierFeatureGroups/);
  assert.match(events, /completeFeatureGroups\(room\.featureGroups, room\.features\)/);
  assert.doesNotMatch(projector, /detail\.rooms\.flatMap\(\(room\) => room\.features\)/);
});
