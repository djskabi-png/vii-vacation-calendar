import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { vacationCatalogFallbacks } from "../app/lib/discovery-catalog-fallback.ts";
import { selectSpaCatalogPackages } from "../app/lib/spa-package-deals.ts";

test("vacation catalog fallback is public, image-backed, bounded and carries no invented availability", () => {
  const places = Array.from({ length: 24 }, (_, index) => ({ supplierId: index + 1, name: `Place ${index + 1}`,
    image: index === 2 ? "" : `https://img.test/${index + 1}.jpg`, images: [`https://img.test/${index + 1}.jpg`],
    location: "עיר", area: "אזור", contact: { phone: "0500000000" } }));
  const result = vacationCatalogFallbacks(places, new Set(places.slice(1).map(place => place.supplierId)));
  assert.equal(result.length, 20);
  assert.equal(result[0].siteID, 2);
  assert.ok(result.every(place => place.image && !("available" in place) && !("price" in place)));
});

test("spa catalog fallback keeps real package facts but does not manufacture day availability", () => {
  const image = "https://www.spaplus.co.il/gallery/package.jpg";
  const sites = [{ id: 7, title: "Spa", titleEN: "Spa", city: "תל אביב", image,
    packages: [{ id: 11, title: "יחיד", price: 250, people: 1, group: false, durationMinutes: 45, image }] }];
  const result = selectSpaCatalogPackages(sites, "2026-10-22", "single");
  assert.equal(result.length, 1);
  assert.equal(result[0].price, 250);
  assert.ok(!("available" in result[0]));
  assert.equal(selectSpaCatalogPackages(sites, "bad-date", "single").length, 0);
});

test("availability rails never render catalog cards as date-bound offers while a refresh is pending", () => {
  const home = readFileSync(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
  const spa = readFileSync(new URL("../app/components/spa-package-deals.tsx", import.meta.url), "utf8");
  const nearRoute = readFileSync(new URL("../app/api/vii/home-deals/route.ts", import.meta.url), "utf8");
  const holidayRoute = readFileSync(new URL("../app/api/vii/home-holiday-deals/route.ts", import.meta.url), "utf8");
  const spaRoute = readFileSync(new URL("../app/api/spa/deals/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(home, /fallbackPlaces|promotional detailHref|הזמינות מתעדכנת ברקע/);
  assert.match(home, /availabilityStatus === "refreshing"/);
  assert.match(home, /shouldCache:[\s\S]*availabilityStatus === "verified"/);
  assert.match(spa, /החבילות והמחירים מוצגים מיד מהקטלוג/);
  for (const route of [nearRoute, holidayRoute, spaRoute]) {
    assert.match(route, /availabilityStatus: "refreshing"/);
    assert.match(route, /waitUntil/);
  }
  for (const route of [nearRoute, holidayRoute]) {
    assert.doesNotMatch(route, /fallbackPlaces|vacationCatalogFallbacks/);
    assert.match(route, /X-VII-Discovery-Cache": "refreshing"/);
  }
});

test("holiday-list retries and selected-deal retries cannot cancel each other", () => {
  const home = readFileSync(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
  assert.match(home, /const \[dealRetry, setDealRetry\] = useState\(0\)/);
  assert.match(home, /const \[holidayListRetry, setHolidayListRetry\] = useState\(0\)/);
  assert.match(home, /\[language, mode, holidayListRetry, clock\?\.key\]/);
  assert.match(home, /\[period, fixedPeriod, holidayId, holidayState, holidays, language, mode, dealRetry,/);
  assert.doesNotMatch(home, /\[language, mode, dealRetry, clock\?\.key\]/);
});

test("both homepage vacation rails recover once from a transient browser request failure", () => {
  const home = readFileSync(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
  const cache = readFileSync(new URL("../app/lib/discovery-client-cache.ts", import.meta.url), "utf8");
  const publicAudit = readFileSync(new URL("../scripts/audit-search-state.cjs", import.meta.url), "utf8");
  assert.match(home, /home-holidays\?locale=\$\{language\}`,[\s\S]*?timeoutMs: 4_000, retries: 1/);
  assert.match(home, /verified-offers-v1`, \{ signal: controller\.signal,[\s\S]*?timeoutMs: 5_000, retries: 1/);
  assert.match(cache, /cache: attempt \? "reload"/,
    "the retry must remain a bounded cache-bypassing GET recovery");
  assert.match(publicAudit, /home-live-deals-results", "home-holiday-deals-results"/);
  assert.match(publicAudit, /home-availability-rails/);
  assert.match(publicAudit, /terminal-error/);
  assert.match(publicAudit, /no-verified-cards/);
});
