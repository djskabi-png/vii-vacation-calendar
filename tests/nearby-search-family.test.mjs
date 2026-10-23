import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("spa and hourly anchor city expansion to managed geography before any regional fallback", async () => {
  for (const path of ["app/components/world-map-results.tsx", "app/components/hourly-results.tsx"]) {
    const source = await read(path);
    assert.match(source, /const managedGeography = useManagedGeography\(location !== "כל הארץ"\)/, path);
    assert.match(source, /nearbySearchRecommendations\(eligible, location, managedGeography,/, path);
    assert.doesNotMatch(source, /return nearbyRecommendations\(eligible,/, path);
  }
});

test("every place-search family shares the minimum-eighteen completion contract", async () => {
  for (const path of ["app/search/page.tsx", "app/events/search/page.tsx", "app/components/world-map-results.tsx", "app/components/hourly-results.tsx"]) {
    const source = await read(path);
    assert.match(source, /completePlaceSearchResults\(filtered,/ , path);
    assert.match(source, /PLACE_SEARCH_MINIMUM_RESULTS/, path);
    assert.match(source, /NearbySearchNotice/, path);
    assert.doesNotMatch(source, /const result(?:Items|Trails|Set)[^;]*=> \[\.\.\.filtered[^;]*slice\(0, 12\)/, path);
  }
  for (const path of ["app/attractions/attractions-explorer.tsx", "app/trails/trails-explorer.tsx"]) {
    const source = await read(path);
    assert.match(source, /completeNearbyResults\(filtered,/ , path);
    assert.doesNotMatch(source, /PLACE_SEARCH_MINIMUM_RESULTS/, path);
  }
});

test("SSR and managed place-search surfaces use the same minimum-eighteen inventory", async () => {
  for (const path of ["app/components/vacation-landing-route.tsx", "app/events/search/[region]/page.tsx", "app/hourly/page.tsx", "app/components/managed-search-landing.tsx"]) {
    const source = await read(path);
    assert.match(source, /completePlaceSearchResults/, path);
  }
  const shared = await read("app/lib/nearby-recommendations.ts");
  assert.match(shared, /PLACE_SEARCH_MINIMUM_RESULTS = 18/);
  assert.match(shared, /limit: PLACE_SEARCH_MINIMUM_RESULTS/);
  assert.match(shared, /minimumResults: PLACE_SEARCH_MINIMUM_RESULTS/);
});

test("event fallback reuses all hard predicates and updates on every filter", async () => {
  const source = await read("app/events/search/page.tsx");
  assert.match(source, /eventPlaces\.filter\(\(place\) => matchesHardFilters\(place\) && confirmedEventPlace\(place\)\)/);
  const predicate = source.slice(source.indexOf("const matchesHardFilters"), source.indexOf("const filtered"));
  for (const field of ["eventType", "guests", "noNoiseLimit", "accessibleOnly", "type"]) assert.ok(predicate.includes(field), field);
  assert.match(source, /hasConfirmedEventAvailability/);
  assert.match(source, /NearbySearchNotice dated=\{Boolean\(eventFrom\)\}/);
});

test("vacation fallback keeps amenities, live price and unavailability eligibility", async () => {
  const source = await read("app/search/page.tsx");
  const nearby = source.slice(source.indexOf("const nearbyRecovery"), source.indexOf("const resultSet"));
  assert.match(nearby, /mapCandidates\.filter/);
  assert.match(nearby, /liveAvailabilityFor\(property\.slug\)/);
  assert.match(nearby, /price < minPrice \|\| price > maxPrice/);
  assert.match(nearby, /confirmedForSelectedStay\(property\)/);
  assert.match(nearby, /!selectedStay && !flexibleSearch/);
  assert.match(source, /NearbySearchNotice dated=\{Boolean\(selectedStay \|\| flexibleSearch\)\}/);
});

test("maps and lists use the same expanded inventory in all client worlds", async () => {
  for (const path of ["app/components/world-map-results.tsx", "app/components/hourly-results.tsx", "app/attractions/attractions-explorer.tsx"]) {
    const source = await read(path);
    assert.match(source, /DeferredDiscoveryMap items=\{resultItems\}/, path);
    assert.doesNotMatch(source, /DeferredDiscoveryMap items=\{filtered\}/, path);
  }
  const trails = await read("app/trails/trails-explorer.tsx");
  assert.match(trails, /DeferredTrailMap trails=\{resultTrails\}/);
  assert.match(trails, /nearbyTrails\(selectedRegions\[0\], "", eligible\.length, \{ inventory: eligible \}\)/);
});

test("dated spa expansion retains audience, amenity and available-site filtering", async () => {
  const source = await read("app/components/world-map-results.tsx");
  assert.match(source, /const eligible = amenityFiltered\.filter/);
  assert.match(source, /availability\.sites\.has/);
  assert.match(source, /filtered\.length >= PLACE_SEARCH_MINIMUM_RESULTS \|\| checkingDate \|\| availabilityFailed/);
});

test("business recommendation reads are public, managed, parallel and failure isolated", async () => {
  const page = await read("app/business/page.tsx");
  assert.match(page, /const \[property, properties, acceptedDetail, trailInventory, spaSites, attractions\] = await Promise\.all/);
  assert.match(page, /managedTrails\(trails\)/);
  assert.match(page, /publicCatalogSummaries<SpaPlusSite>\("spa"\)\.catch/);
  assert.match(page, /managedDiscoveryItems/);
  assert.match(page, /const nearbyTrailInventory = nearbyTrails/);
  assert.match(page, /trailInventory=\{nearbyTrailInventory\}/);
  assert.match(page, /complementaryInventory=\{nearbyComplementaryInventory\}/);
});
