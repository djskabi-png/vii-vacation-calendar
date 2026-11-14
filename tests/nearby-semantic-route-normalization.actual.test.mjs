import assert from "node:assert/strict";
import test from "node:test";
import { canonicalNearestNearbyUrl, normalizeHomepageItems, semanticNearbyPath } from "../app/lib/homepage-search-href.ts";

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

test("legacy nearest query routes canonicalize across every supported world and locale", () => {
  const routes = {
    "/search": "/vacations/near-me",
    "/spas": "/spas/near-me",
    "/events/search": "/events/near-me",
    "/hourly": "/hourly/near-me",
    "/attractions": "/attractions/near-me",
    "/trails": "/trails/near-me",
    "/providers": "/providers/near-me",
  };
  for (const locale of ["", "/en", "/fr", "/ru"]) {
    for (const [source, destination] of Object.entries(routes)) {
      const input = new URL(`https://vii.spaplus.co${locale}${source}?sort=nearest&from=2026-11-27&guests=2`);
      const canonical = canonicalNearestNearbyUrl(input);
      assert.ok(canonical, `${locale}${source}`);
      assert.equal(canonical.pathname, `${locale}${destination}`);
      assert.equal(canonical.searchParams.has("sort"), false);
      assert.equal(canonical.searchParams.get("from"), "2026-11-27");
      assert.equal(canonical.searchParams.get("guests"), "2");
    }
  }
});

test("canonical nearest pages shed the redundant sort once and other sorts are untouched", () => {
  const canonical = canonicalNearestNearbyUrl(new URL("https://vii.spaplus.co/hourly/near-me?sort=nearest&features=jacuzzi"));
  assert.equal(canonical?.toString(), "https://vii.spaplus.co/hourly/near-me?features=jacuzzi");
  assert.equal(canonicalNearestNearbyUrl(new URL("https://vii.spaplus.co/hourly?sort=price-asc")), null);
  assert.equal(canonicalNearestNearbyUrl(new URL("https://vii.spaplus.co/business?sort=nearest")), null);
});

test("the server proxy applies canonical nearby redirects before location-page normalization", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../proxy.ts", import.meta.url), "utf8"));
  assert.match(source, /canonicalNearestNearbyUrl\(request\.nextUrl\)/);
  assert.match(source, /NextResponse\.redirect\(canonicalNearby, 301\)/);
  assert.ok(source.indexOf("canonicalNearestNearbyUrl(request.nextUrl)") < source.indexOf("canonicalLocationDestination(request.nextUrl)"));
});
