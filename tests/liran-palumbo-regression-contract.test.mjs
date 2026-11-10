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
  // The actual deadline/cancellation state transitions are exercised in
  // spa-availability-client-deadline-actual.test.mjs. A fixed 6s assertion
  // rejected valid measured 7s production responses without testing an exit.
  assert.match(spa, /window\.clearTimeout\(deadline\)/);
});

test("unit gallery sources keep every supplier and unit classification", () => {
  const gallery = read("../app/components/gallery-experience.tsx");
  const selection = read("../app/components/gallery-selection.ts");
  assert.match(gallery, /property\.galleryGroups\?\.length/);
  assert.match(gallery, /group\.title/);
  assert.match(gallery, /const groupedSources = new Set/);
  assert.match(gallery, /\.\.\.groupedPlaceItems/);
  assert.match(gallery, /\.\.\.unitItems,/);
  assert.doesNotMatch(gallery, /unitItems\.filter/);
  assert.match(selection, /const identity = `\$\{item\.category\}\\u0000\$\{keyFor\(item\)\}\\u0000\$\{item\.src\}`/);
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
  assert.match(event, /localizedEventBreadcrumbs = localizedPlaceBreadcrumbs\(eventBreadcrumbsForLocation\(place\.area, place\.location\)/);
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
  assert.doesNotMatch(business, /property-title__trust-signals|ListingAccessibility[^\n]*compact/);
  assert.doesNotMatch(event, /property-title__trust-signals|ListingAccessibility[^\n]*compact/);
  assert.doesNotMatch(discovery, /ListingAccessibility slug=\{item\.id\} features=\{item\.features\} compact/);
  assert.match(business, /ListingAccessibility slug=\{property\.slug\} features=\{property\.features\}/);
  assert.match(event, /ListingAccessibility slug=\{place\.slug\} features=\{place\.features\}/);
  assert.match(discovery, /discovery-detail__accessibility[\s\S]*ListingAccessibility slug=\{item\.id\}/);
});

test("vacation price URL state survives supplier starting-price hydration", () => {
  const search = read("../app/search/page.tsx");
  assert.match(search, /setMinPrice\(Math\.min\(requestedMinPrice, requestedMaxPrice\)\)/);
  assert.match(search, /setMaxPrice\(Math\.max\(requestedMinPrice, requestedMaxPrice\)\)/);
  assert.doesNotMatch(search, /set(?:Min|Max)Price\(priceFilterAvailable/);
});
