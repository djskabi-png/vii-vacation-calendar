import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { canonicalVerifiedSliderItems } from "../app/lib/verified-slider-offers.ts";
import { orderDiscoveryItems } from "../app/lib/discovery-slider-order.ts";

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

test("verified vacation and event rails apply stable weighted exposure after supplier acceptance", () => {
  const vacation = readFileSync(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
  assert.match(vacation, /canonicalVerifiedSliderItems\(eligibleDeals, deal => deal\.siteID\)/);
  assert.match(vacation, /useDocumentSeed/);
  assert.match(vacation, /orderDiscoveryItems/);

  const events = readFileSync(new URL("../app/components/event-last-minute.tsx", import.meta.url), "utf8");
  assert.match(events, /const supplierOrder = search\.resultOrder\.length/);
  assert.match(events, /uniqueEventVenueItems\(supplierOrder\.flatMap/);
  const verifiedSection = events.slice(events.indexOf("const supplierOrder"), events.indexOf("const confirmed"));
  assert.match(verifiedSection, /documentSeed/);
  assert.match(verifiedSection, /orderDiscoveryItems/);
});

test("weighted rail exposure preserves accepted identities, price cohorts and selected-search stability", () => {
  const offers = [
    { id: 1, online: false, priority: 0, weight: 99 },
    { id: 2, online: true, priority: 1, weight: 99 },
    { id: 3, online: true, priority: 0, weight: 1 },
    { id: 4, online: true, priority: 0, weight: 5 },
    { id: 4, online: true, priority: 0, weight: 100 },
  ];
  const accepted = canonicalVerifiedSliderItems(offers, offer => offer.id);
  const options = { id: offer => offer.id, online: offer => offer.online, priority: offer => offer.priority, promotionWeight: offer => offer.weight, seed: "same-search" };
  const result = orderDiscoveryItems(accepted, options);
  assert.deepEqual(result.map(offer => offer.id), [4, 3, 2, 1]);
  assert.deepEqual(orderDiscoveryItems(accepted, options), result);
  assert.deepEqual(result.map(offer => offer.id).sort(), accepted.map(offer => offer.id).sort());
  assert.equal(result[0].weight, 5, "duplicate offers cannot replace the accepted supplier record");
  assert.deepEqual(accepted.map(offer => offer.id), [1, 2, 3, 4], "exposure ordering cannot mutate the accepted snapshot");
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
