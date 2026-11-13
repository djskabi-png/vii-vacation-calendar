import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { canonicalVerifiedItems, canonicalVerifiedSliderItems } from "../app/lib/verified-slider-offers.ts";
import { orderDiscoveryItems } from "../app/lib/discovery-slider-order.ts";

test("permanent result grids keep every verified identity while discovery rails remain bounded", () => {
  const offers = Array.from({ length: 42 }, (_, index) => ({
    siteID: index + 1,
    online: index < 13,
    price: index === 41 ? null : 500 + index,
    available: true,
  }));
  offers.push({ ...offers[0], price: 9_999 });

  const grid = canonicalVerifiedItems(offers, offer => offer.siteID, offer => offer.available);
  const rail = canonicalVerifiedSliderItems(offers, offer => offer.siteID, offer => offer.available);

  assert.equal(grid.length, 42);
  assert.equal(new Set(grid.map(offer => offer.siteID)).size, 42);
  assert.equal(rail.length, 20);
  assert.equal(grid.at(-1).price, null, "a verified available no-price place must remain reachable");
});

test("online readiness changes full-grid order but never removes telephone-ready or no-price places", () => {
  const offers = [
    { siteID: 1, online: false, price: null },
    { siteID: 2, online: true, price: 900 },
    { siteID: 3, online: false, price: 800 },
  ];
  const complete = canonicalVerifiedItems(offers, offer => offer.siteID);
  const ordered = orderDiscoveryItems(complete, { id: offer => offer.siteID, online: offer => offer.online, seed: "fixture" });

  assert.equal(ordered[0].siteID, 2);
  assert.deepEqual(ordered.map(offer => offer.siteID).sort(), [1, 2, 3]);
});

test("HomeLiveDeals separates full grids from bounded rails and paces expensive grid cards", () => {
  const source = readFileSync(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
  assert.match(source, /layout === "grid"\s*\? canonicalVerifiedItems\(eligibleDeals/);
  assert.match(source, /: canonicalVerifiedSliderItems\(eligibleDeals/);
  assert.match(source, /layout === "grid" \|\| deferUntilNearViewport && layout === "rail"/);

  const weekend = readFileSync(new URL("../app/weekend/[period]/page.tsx", import.meta.url), "utf8");
  const lastMinute = readFileSync(new URL("../app/last-minute/page.tsx", import.meta.url), "utf8");
  assert.match(weekend, /layout="grid"/);
  assert.match(lastMinute, /layout="grid"/);
});
