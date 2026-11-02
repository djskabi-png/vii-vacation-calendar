import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import legacyTypes from "../app/data/legacy-vacation-accommodation-types.json" with { type: "json" };
import { accommodationListings, getAccommodationCategory } from "../app/data/accommodation-landings.ts";
import { projectSergeyPublicCatalogValue } from "../app/lib/sergey-public-catalog-projection.ts";
import { vacationAccommodationTypes } from "../app/lib/vacation-accommodation-types.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the accepted legacy taxonomy snapshot preserves the complete current zimmer membership", () => {
  assert.equal(legacyTypes.counts["צימרים"], 166);
  assert.equal(Object.values(legacyTypes.memberships).filter((types) => types.includes("צימרים")).length, 166);
});

test("public projection restores secondary legacy memberships on already accepted summaries", () => {
  const projected = projectSergeyPublicCatalogValue({ supplierId: 233, world: "vacations", slug: "vacation-233", type: "סוויטה" });
  assert.ok(projected.types.includes("צימרים"));
  assert.ok(projected.types.includes("סוויטה"));
});

test("API room types take part alongside primary and compatibility types", () => {
  const types = vacationAccommodationTypes({ supplierId: 233, slug: "vacation-233", type: "סוויטה", types: ["מערה"] }, ["צימר"]);
  assert.deepEqual(types, ["מערה", "צימר", ...legacyTypes.memberships["233"], "סוויטה"].filter((value, index, values) => values.indexOf(value) === index));
});

test("accommodation landings match a secondary type instead of only the primary type", () => {
  const category = getAccommodationCategory("zimmers");
  assert.ok(category);
  const base = { slug: "vacation-1", name: "בדיקה", location: "כלנית", area: "כנרת", type: "סוויטה", types: ["סוויטה", "צימר"], guests: 2,
    image: "/image.jpg", images: ["/image.jpg"], description: "", features: [], audiences: [], badges: [], scenario: "single" };
  assert.deepEqual(accommodationListings(category, undefined, [base]).map((property) => property.slug), ["vacation-1"]);
});

test("the bundled vacation inventory also receives the multi-type projection", () => {
  const source = read("app/data/site-data.ts");
  assert.match(source, /withVacationAccommodationTypes\(place\)/);
});

test("zimmer taxonomy has a clean route, canonical metadata path and sitemap inventory source", () => {
  assert.match(read("app/zimmers/[[...region]]/page.tsx"), /categoryId="zimmers"/);
  assert.match(read("app/data/accommodation-landings.ts"), /path: "\/zimmers"/);
  assert.match(read("app/components/accommodation-landing-route.tsx"), /alternates: \{ canonical: landing\.path \}/);
  assert.match(read("app/lib/sitemap-inventory.ts"), /indexableAccommodationLandings/);
  assert.match(read("app/search/layout.tsx"), /alternates: \{ canonical: "\/search" \}/);
});

test("price sorting is offered independently of the initial lightweight catalog price field", () => {
  const source = read("app/search/page.tsx");
  assert.match(source, /\.\.\.\[\{ value: "price-asc"/);
  assert.doesNotMatch(source, /supplierPriceFilterAvailable \? \[\{ value: "price-asc"/);
});
