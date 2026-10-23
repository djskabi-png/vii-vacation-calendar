import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("live availability requests have bounded exits instead of permanent loading states", () => {
  const search = read("../app/components/use-vii-live-search.ts");
  const calendar = read("../app/components/use-vii-stay-calendar.ts");
  const spa = read("../app/components/world-map-results.tsx");
  assert.match(search, /discoveryJson\("\/api\/vii\/live-search"/);
  assert.match(calendar, /Stay calendar timed out/);
  assert.match(calendar, /8_000/);
  assert.match(spa, /Spa availability timed out/);
  assert.match(spa, /6_000/);
});

test("unit gallery sources keep one classification and the supplier group titles", () => {
  const gallery = read("../app/components/gallery-experience.tsx");
  assert.match(gallery, /property\.galleryGroups\?\.length/);
  assert.match(gallery, /const unitBySource = new Map/);
  assert.match(gallery, /group\.title/);
  assert.match(gallery, /groupedPlaceItems\.map\(\(item\) => unitBySource\.get\(item\.src\) \|\| item\)/);
  assert.doesNotMatch(gallery, /index > 0.*unitBySource/);
});

test("place breadcrumbs include a canonical geographic search level in every location world", () => {
  const business = read("../app/business/client-page.tsx");
  const event = read("../app/events/place/client-page.tsx");
  const discovery = read("../app/discover/place/client-page.tsx");
  assert.match(business, /\.\.\.eventBreadcrumbsForLocation\(property\.area, property\.location\)/);
  assert.match(business, /\.\.\.hourlyBreadcrumbsForLocation\(property\.area, property\.location\)/);
  assert.match(business, /\.\.\.spaBreadcrumbsForLocation\(property\.area, property\.location\)/);
  assert.match(event, /\.\.\.eventBreadcrumbsForLocation\(place\.area, place\.location\)/);
  assert.match(discovery, /\.\.\.spaBreadcrumbsForLocation\(item\.area, item\.location\)/);
});

test("booking price basis and accessibility navigation use the authoritative fields", () => {
  const booking = read("../app/booking/page.tsx");
  const business = read("../app/business/client-page.tsx");
  const event = read("../app/events/place/client-page.tsx");
  assert.match(booking, /selectedUnit\?\.basisGuests \|\| selectedUnit\?\.guests/);
  assert.match(business, /hasVerifiedAccessibilityFeature\(property\.features\)/);
  assert.match(event, /hasVerifiedAccessibilityFeature\(place\.features\)/);
});

test("verified physical accessibility is recognized narrowly and shown before the long place content", () => {
  const data = read("../app/data/accessibility-data.ts");
  const listing = read("../app/components/listing-accessibility.tsx");
  const business = read("../app/business/client-page.tsx");
  const event = read("../app/events/place/client-page.tsx");
  const discovery = read("../app/discover/place/client-page.tsx");
  assert.match(data, /"נגישות לנכים"/);
  assert.match(data, /"נגישות מלאה לנכים"/);
  assert.match(data, /verified\.has\(normalizeFeature\(feature\)\)/);
  assert.doesNotMatch(data, /includes\("נגיש"\)/);
  assert.match(listing, /compact\).*href="#accessibility"/s);
  assert.match(business, /property-title__trust-signals[\s\S]*ListingAccessibility slug=\{property\.slug\}[\s\S]*compact/);
  assert.match(event, /property-title__trust-signals[\s\S]*ListingAccessibility slug=\{place\.slug\}[\s\S]*compact/);
  assert.match(discovery, /ListingAccessibility slug=\{item\.id\} features=\{item\.features\} compact/);
});

test("vacation price URL state survives supplier starting-price hydration", () => {
  const search = read("../app/search/page.tsx");
  assert.match(search, /setMinPrice\(priceFilterAvailable \?/);
  assert.match(search, /setMaxPrice\(priceFilterAvailable \?/);
  assert.match(search, /priceFilterAvailable, properties/);
});
