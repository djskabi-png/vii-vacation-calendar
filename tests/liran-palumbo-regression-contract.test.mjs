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
  assert.match(gallery, /group\.title/);
  assert.match(gallery, /const groupedSources = new Set/);
  assert.match(gallery, /\.\.\.groupedPlaceItems/);
  assert.match(gallery, /unitItems\.filter\(\(item\) => !groupedSources\.has\(item\.src\)\)/);
  assert.match(gallery, /topicTabs\.map/);
  assert.doesNotMatch(gallery, /groupedPlaceItems\.map\(\(item\) => unitBySource/);
});

test("place breadcrumbs include a canonical geographic search level in every location world", () => {
  const business = read("../app/business/client-page.tsx");
  const event = read("../app/events/place/client-page.tsx");
  const discovery = read("../app/discover/place/client-page.tsx");
  assert.match(business, /localizedLocationBreadcrumbs\(eventBreadcrumbsForLocation\(property\.area, property\.location\), breadcrumbPrefixes\.events\)/);
  assert.match(business, /localizedLocationBreadcrumbs\(hourlyBreadcrumbsForLocation\(property\.area, property\.location\), breadcrumbPrefixes\.hourly\)/);
  assert.match(business, /localizedLocationBreadcrumbs\(spaBreadcrumbsForLocation\(property\.area, property\.location\), breadcrumbPrefixes\.spa\)/);
  assert.match(event, /localizedEventBreadcrumbs = eventBreadcrumbsForLocation\(place\.area, place\.location\)\.map/);
  assert.match(discovery, /localizedBreadcrumbs\(spaBreadcrumbsForLocation\(item\.area, item\.location\), breadcrumbPrefix\.spa\)/);
});

test("booking price basis stays authoritative and accessibility is not a misleading anchor", () => {
  const booking = read("../app/booking/page.tsx");
  const business = read("../app/business/client-page.tsx");
  const event = read("../app/events/place/client-page.tsx");
  assert.match(booking, /selectedUnit\?\.basisGuests \|\| selectedUnit\?\.guests/);
  assert.doesNotMatch(business, /href: "#accessibility"/);
  assert.doesNotMatch(event, /href: "#accessibility"/);
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
  assert.match(listing, /if \(compact\) return <span className="place-accessibility-badge/);
  assert.doesNotMatch(listing, /href="#accessibility"/);
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
