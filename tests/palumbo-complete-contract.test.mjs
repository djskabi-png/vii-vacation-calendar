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

test("holiday, contact and card requirements remain explicit", async () => {
  const [deals, model] = await Promise.all([
    source("app/components/home-live-deals.tsx"),
    source("app/lib/vii-home-deals.ts"),
  ]);
  assert.doesNotMatch(deals, /<small>\{dateLabel\(item\.from/);
  assert.match(deals, /<WhatsAppLeadButton/);
  assert.match(deals, /initialGuests=\{deal\.priceGuests\}/);
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
  assert.match(box, /אזורים ותתי אזורים/);
  assert.match(box, /ערים ויישובים/);
  assert.match(box, /visibleDestinations[\s\S]*visibleNamedPlaces/);
  assert.doesNotMatch(calendar, /<span><i className="legend-dot general" \/> כל תאריך עתידי ניתן לחיפוש<\/span>/);
  assert.match(calendar, /גמישות בתאריכים/);
  assert.match(calendar, /לא חייבים לבחור ימים מדויקים/);
});
