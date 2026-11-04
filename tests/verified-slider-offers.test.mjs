import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { canonicalVerifiedSliderItems } from "../app/lib/verified-slider-offers.ts";

test("verified slider keeps API order, removes invalid duplicates and caps after acceptance", () => {
  const items = [
    { id: 8, valid: true, price: 800 },
    { id: 2, valid: false, price: 200 },
    { id: 8, valid: true, price: 999 },
    ...Array.from({ length: 30 }, (_, index) => ({ id: index + 20, valid: true, price: index })),
  ];
  const result = canonicalVerifiedSliderItems(items, item => item.id, item => item.valid);
  assert.equal(result.length, 20);
  assert.deepEqual(result.slice(0, 4).map(item => item.id), [8, 20, 21, 22]);
  assert.equal(result[0].price, 800);
  assert.deepEqual(canonicalVerifiedSliderItems(items, item => item.id, item => item.valid), result);
});

test("verified vacation and event rails cannot reshuffle an accepted API payload in the browser", () => {
  const vacation = readFileSync(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
  assert.match(vacation, /canonicalVerifiedSliderItems\(eligibleDeals, deal => deal\.siteID\)/);
  assert.doesNotMatch(vacation, /useDocumentSeed|orderDiscoveryRail/);

  const events = readFileSync(new URL("../app/components/event-last-minute.tsx", import.meta.url), "utf8");
  assert.match(events, /const supplierOrder = search\.resultOrder\.length/);
  assert.match(events, /uniqueEventVenueItems\(supplierOrder\.flatMap/);
  const verifiedSection = events.slice(events.indexOf("const supplierOrder"), events.indexOf("const confirmed"));
  assert.doesNotMatch(verifiedSection, /documentSeed|orderDiscoveryRail/);
});

test("event API returns only complete offers with matching public cards in the same order", () => {
  const route = readFileSync(new URL("../app/api/vii/live-search/route.ts", import.meta.url), "utf8");
  assert.match(route, /eventOffersForSlot/);
  assert.match(readFileSync(new URL("../app/lib/event-discovery-offers.ts", import.meta.url), "utf8"), /Number\.isSafeInteger\(offer\.roomID\)/);
  assert.match(route, /const visibleOffers = offers\.filter\(offer => placeById\.has\(offer\.siteID\)\)/);
  assert.match(route, /const visiblePlaces = visibleOffers\.map\(offer => placeById\.get\(offer\.siteID\)!\)/);
  assert.match(route, /results: visibleOffers/);
  assert.match(route, /places: visiblePlaces\.map/);
});

test("selected public summaries support the full twenty-card discovery rail", () => {
  for (const file of ["../app/lib/public-catalog-read.ts", "../app/lib/supplier-catalog-store.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /slice\(0, 20\)/);
  }
});
