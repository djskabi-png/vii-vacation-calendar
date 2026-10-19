import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage discovery is visual, managed and complete", async () => {
  const [home, showcase, discovery, admin, presentation] = await Promise.all([
    source("app/page.tsx"),
    source("app/components/home-showcase.tsx"),
    source("app/components/home-discovery-sections.tsx"),
    source("app/admin/content-studio/page.tsx"),
    source("app/lib/homepage-presentation.ts"),
  ]);
  assert.match(home, /<HomeQuickSearches/);
  assert.match(showcase, /<HomeManagedDiscovery/);
  for (const key of ["homePopularSearches", "homeCitySearches", "homeTypeSearches", "homeEditorialTitle", "homeEditorialBody"]) {
    assert.match(admin, new RegExp(key));
    assert.match(presentation, new RegExp(key));
  }
  assert.match(discovery, /חיפוש לפי עיר ואזור/);
  assert.match(discovery, /סוגי מקומות נופש/);
});

test("place-type cards use distinct relevant photography without the unavailable placeholder", async () => {
  const presentation = await source("app/lib/homepage-presentation.ts");
  const typeBlock = presentation.match(/types: \[([\s\S]*?)\n  \]/)?.[1] || "";
  const images = [...typeBlock.matchAll(/image: "([^"]+)"/g)].map((match) => match[1]);
  assert.equal(images.length, 5);
  assert.equal(new Set(images).size, images.length);
  assert.doesNotMatch(typeBlock, /e65d757e686fda64|c3a6274bfd08091a/);
  assert.match(typeBlock, /hilat-hanof\/535f7c268ed1dc4\.jpeg/);
  assert.match(typeBlock, /88fcef4341b24a45\.jpeg/);
});

test("holiday, contact and card requirements remain explicit", async () => {
  const [deals, model, sharedCard] = await Promise.all([
    source("app/components/home-live-deals.tsx"),
    source("app/lib/vii-home-deals.ts"),
    source("app/components/property-card.tsx"),
  ]);
  assert.doesNotMatch(deals, /<small>\{dateLabel\(item\.from/);
  assert.match(deals, /<PropertyCard/);
  assert.match(deals, /selectedStay=\{\{ from: deal\.from, till: deal\.till, guests: deal\.priceGuests \}\}/);
  assert.match(deals, /legacyHolidaySearchPath|currentHoliday\?\.href/);
  assert.match(sharedCard, /<WhatsAppLeadButton/);
  assert.match(model, /whatsapp\?: string/);
});

test("vacation discovery and result controls implement Palumbo requirements", async () => {
  const [search, box, calendar, progressive] = await Promise.all([
    source("app/search/page.tsx"),
    source("app/components/search-box.tsx"),
    source("app/calendar-demo.tsx"),
    source("app/components/progressive-results.tsx"),
  ]);
  assert.match(search, /א-ב \(סדר עולה\)/);
  assert.match(search, /מחיר ומאפיינים/);
  assert.match(search, /<ProgressiveResults autoLoad/);
  assert.match(progressive, /IntersectionObserver/);
  assert.match(box, /destinationChildren\(destinations, browseKey/);
  assert.match(box, /matchingDestinations\(destinations, locationQuery, translate\)/);
  assert.match(box, /visibleDestinations[\s\S]*visibleNamedPlaces/);
  assert.doesNotMatch(calendar, /<span><i className="legend-dot general" \/> כל תאריך עתידי ניתן לחיפוש<\/span>/);
  assert.match(calendar, /גמישות בתאריכים/);
  assert.match(calendar, /לא חייבים לבחור ימים מדויקים/);
});
