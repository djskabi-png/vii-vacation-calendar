import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("homepage cards reserve separate zones for labels and content", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(css, /home-vacation-card--destination > div[^}]*position:\s*absolute[^}]*bottom:\s*0/s);
  assert.match(css, /home-vacation-card--destination > div > span[^}]*margin-bottom:\s*8px/s);
  assert.match(css, /home-vacation-card--destination > div[^}]*padding:\s*76px/s);
});

test("homepage discovery uses complete card compositions", async () => {
  const component = await readFile(new URL("app/components/home-showcase.tsx", root), "utf8");
  assert.doesNotMatch(component, /home-vacation-card--compact/);
  assert.match(component, /home-vacation-card--destination/);
  assert.match(component, /src=\{place.image\}/);
});

test("supplier homepage searches live dates without unsupported static offers", async () => {
  const [showcase, deals, route, token] = await Promise.all([
    readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/vii/home-deals/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/vii-supplier-token.ts", import.meta.url), "utf8"),
  ]);
  assert.match(showcase, /<HomeLiveDeals \/>/);
  assert.match(showcase, /<HomeLiveDeals mode="holidays" \/>/);
  assert.match(showcase, /properties.find/);
  assert.match(deals, /`\/api\/vii\/home-deals\?period=\$\{period\}`/);
  assert.match(deals, /`\/api\/vii\/home-holiday-deals\?id=\$\{holidayId\}`/);
  assert.match(deals, /data\.deals\.map/);
  assert.match(route, /supplierToken\(\)/);
  assert.match(token, /SERGEY_VII_API_TOKEN/);
  assert.doesNotMatch(showcase, /nightlyPrice|lastMinuteHref|selectDealPeriod|home-vacation-card--style/);
});

test("homepage period offers preserve the verified legacy dates and prices", async () => {
  const deals = await readFile(new URL("../app/data/last-minute-deals.ts", import.meta.url), "utf8");
  assert.match(deals, /legacyTab: "lastminute"[\s\S]*from: "2026-08-16"[\s\S]*nightlyPrice: 3500/);
  assert.match(deals, /legacyTab: "weekend"[\s\S]*nightlyPrice: 3250[\s\S]*nightlyPrice: 1200[\s\S]*nightlyPrice: 900/);
  assert.match(deals, /legacyTab: "weekend2"[\s\S]*nightlyPrice: 3250[\s\S]*nightlyPrice: 1200[\s\S]*nightlyPrice: 850/);
  assert.match(deals, /legacyTab: "holiday111"[\s\S]*nightlyPrice: 4000[\s\S]*nightlyPrice: 5000/);
  assert.match(deals, /legacyTab: "holiday114"[\s\S]*nightlyPrice: 6000[\s\S]*nightlyPrice: 3500/);
  assert.match(deals, /publishedLastMinuteDeal[\s\S]*candidate\.nightlyPrice === nightlyPrice/);
});

test("stale period business links canonicalize to the current verified offer", async () => {
  const page = await readFile(new URL("../app/business/page.tsx", import.meta.url), "utf8");
  const deals = await readFile(new URL("../app/data/last-minute-deals.ts", import.meta.url), "utf8");
  assert.match(deals, /function currentPeriodOffer[\s\S]*candidate\.id === period[\s\S]*offer\.slug === slug/);
  assert.match(page, /currentPeriodOffer\(property\.slug, params\.period\)/);
  assert.match(page, /params\.from !== currentOffer\.from/);
  assert.match(page, /params\.till !== currentOffer\.till/);
  assert.match(page, /Number\(params\.price\) !== currentOffer\.nightlyPrice/);
  assert.match(page, /source: params\.source \|\| "last-minute"/);
  assert.match(page, /redirect\(`\$\{prefix\}\/business\?\$\{canonical\.toString\(\)\}`\)/);
});

test("homepage commercial cards include visible semantic artwork", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /GiftIcon/);
  assert.match(page, /PeopleIcon/);
  assert.equal((page.match(/home-corporate-gift__visual/g) || []).length, 2);
});

test("ordinary homepage sections share the compact spacing contract", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  for (const selector of ["home-recommended", "home-last-minute", "home-vacation-discovery", "home-spa-strip", "home-short-stay", "home-corporate-gift"]) {
    assert.match(css, new RegExp(`\\.${selector}[^}]*padding-block:\\s*64px`));
  }
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*home-corporate-gift[^}]*padding-block:\s*48px/);
});

test("spa result filters use compact illustrated choice tiles without a duplicate location card", async () => {
  const component = await readFile(new URL("app/components/world-map-results.tsx", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(component, /function SpaFilterIcon/);
  for (const id of ["hotel", "boutique", "pool", "jacuzzi", "sauna", "gym", "couples", "day-pass"]) {
    assert.match(component, new RegExp(`id === "${id}"`));
  }
  assert.doesNotMatch(component, /spa-results__location-card/);
  assert.match(component, /spa-results__filter-icon/);
  assert.match(component, /spa-results__filter-label/);
  assert.match(css, /spa-results__landing-links > div[^}]*grid-template-columns:\s*repeat\(9/);
  assert.match(css, /spa-results__filter-icon[^}]*border-radius:\s*50%/);
  assert.match(css, /spa-results__landing-links[^}]*overflow/);
});
