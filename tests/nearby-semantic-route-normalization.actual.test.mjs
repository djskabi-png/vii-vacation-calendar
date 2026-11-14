import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHomepageItems, semanticNearbyPath } from "../app/lib/homepage-search-href.ts";

test("nearby managed tiles normalize legacy generic search URLs to semantic world paths", () => {
  const items = [
    { href: "/events/search?sort=nearest", action: "nearby" },
    { href: "/events/search", action: "nearby" },
    { href: "/providers?region=%D7%A6%D7%A4%D7%95%D7%9F", action: "nearby" },
    { href: "/events/search?type=%D7%9C%D7%95%D7%A4%D7%98%D7%99%D7%9D", action: undefined },
  ];
  assert.deepEqual(normalizeHomepageItems(items).map(item => item.href), ["/events/near-me", "/search/events/israel-35aac0f1"]);
});

test("search modes use their canonical nearby pathname", () => {
  assert.equal(semanticNearbyPath("/villas", "vacation"), "/vacations/near-me");
  assert.equal(semanticNearbyPath("/spas/spa-with-pool", "spa"), "/spas/near-me");
  assert.equal(semanticNearbyPath("/events/search", "events"), "/events/near-me");
  assert.equal(semanticNearbyPath("/hourly", "hourly"), "/hourly/near-me");
});
