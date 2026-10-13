import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("search navigation stays inside the app router", async () => {
  const source = await readFile(new URL("app/components/search-box.tsx", root), "utf8");
  assert.match(source, /router\.push\(target\)/);
  assert.doesNotMatch(source, /window\.location\.assign\(target\)/);
});

test("result maps are deferred until the map view is opened", async () => {
  const [deferred, vacation, events, hourly, worlds, attractions] = await Promise.all([
    readFile(new URL("app/components/deferred-listing-map.tsx", root), "utf8"),
    readFile(new URL("app/search/page.tsx", root), "utf8"),
    readFile(new URL("app/events/search/page.tsx", root), "utf8"),
    readFile(new URL("app/components/hourly-results.tsx", root), "utf8"),
    readFile(new URL("app/components/world-map-results.tsx", root), "utf8"),
    readFile(new URL("app/attractions/attractions-explorer.tsx", root), "utf8"),
  ]);
  assert.match(deferred, /dynamic\(/);
  assert.match(deferred, /import\("\.\/listing-map"\)/);
  for (const source of [vacation, events]) assert.match(source, /DeferredListingMap/);
  for (const source of [hourly, worlds, attractions]) assert.match(source, /DeferredDiscoveryMap/);
});

test("below-fold media does not compete with the first screen", async () => {
  const [home, page, property, discovery] = await Promise.all([
    readFile(new URL("app/components/home-showcase.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/components/property-card.tsx", root), "utf8"),
    readFile(new URL("app/components/discovery-card.tsx", root), "utf8"),
  ]);
  assert.match(home, /preload="none"/);
  for (const source of [home, page, property, discovery]) assert.match(source, /loading="lazy"/);
});

test("hashed assets receive a long immutable browser cache", async () => {
  const worker = await readFile(new URL("worker/index.ts", root), "utf8");
  assert.match(worker, /url\.pathname\.startsWith\("\/assets\/"\)/);
  assert.match(worker, /public, max-age=31536000, immutable/);
});

test("shared navigation paths do not bundle the vacation catalog", async () => {
  const [vacation, accommodation, spa] = await Promise.all([
    readFile(new URL("app/data/vacation-landings.ts", root), "utf8"),
    readFile(new URL("app/data/accommodation-landings.ts", root), "utf8"),
    readFile(new URL("app/data/spa-search-landings.ts", root), "utf8"),
  ]);
  assert.doesNotMatch(vacation, /import \{ properties/);
  assert.doesNotMatch(accommodation, /import \{ properties/);
  assert.doesNotMatch(spa, /from "\.\/spa-details"/);
});

test("home cards receive only their featured world previews", async () => {
  const home = await readFile(new URL("app/components/home-showcase.tsx", root), "utf8");
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.doesNotMatch(home, /import \{ paidAttractions, providerProfiles/);
  assert.match(page, /providerPreview=\{providerProfiles\[0\]\}/);
  assert.match(page, /attractionPreview=\{paidAttractions\[0\]\}/);
  assert.match(page, /function homeShowcaseProperties\(properties: Property\[\]\)/);
  assert.doesNotMatch(page, /const showcaseProperties = properties\.map/);
});

test("vacation search serializes a compact catalog and only the visible card window", async () => {
  const [layout, projection, search, progressive] = await Promise.all([
    readFile(new URL("app/search/layout.tsx", root), "utf8"),
    readFile(new URL("app/lib/public-vacation-search.ts", root), "utf8"),
    readFile(new URL("app/search/page.tsx", root), "utf8"),
    readFile(new URL("app/components/progressive-results.tsx", root), "utf8"),
  ]);
  assert.match(layout, /publicVacationSearchProperties/);
  assert.match(projection, /\.slice\(0, 5\)/);
  assert.doesNotMatch(projection, /sourceUrl/);
  assert.match(search, /displayedResults\.slice\(0, visibleResultCount\)/);
  assert.match(search, /totalCount=\{displayedResults\.length\}/);
  assert.match(progressive, /onShowMore/);
});

test("shared navigation deliberately warms the localized homepage on capable connections", async () => {
  const [warmup, shell, header] = await Promise.all([
    readFile(new URL("app/components/smart-navigation-warmup.tsx", root), "utf8"),
    readFile(new URL("app/components/page-shell.tsx", root), "utf8"),
    readFile(new URL("app/site-header.tsx", root), "utf8"),
  ]);
  assert.match(warmup, /router\.prefetch\(home\)/);
  assert.match(warmup, /saveData/);
  assert.match(warmup, /slow-2g/);
  assert.match(shell, /<SmartNavigationWarmup/);
  assert.match(header, /href=\{homeHref\} prefetch/);
  assert.match(header, /data-global-feedback="true"/);
});

test("homepage does not prefetch heavyweight search result documents before intent", async () => {
  const [page, showcase, deals, switcher] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/components/home-showcase.tsx", root), "utf8"),
    readFile(new URL("app/components/home-live-deals.tsx", root), "utf8"),
    readFile(new URL("app/components/world-switcher.tsx", root), "utf8"),
  ]);
  assert.match(page, /href="\/search" prefetch=\{false\}/);
  assert.match(page, /href=\{`\/search\?location=.*?prefetch=\{false\}/s);
  assert.match(showcase, /href=\{item\.href\} prefetch=\{false\}/);
  assert.match(deals, /href=\{searchHref\} prefetch=\{false\}/);
  assert.match(switcher, /world-dock__prehydrate[^>]+prefetch=\{false\}/);
});
