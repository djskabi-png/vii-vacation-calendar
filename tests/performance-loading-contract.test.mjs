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

test("a map chunk removed by a newer deployment recovers with one bounded reload", async () => {
  const deferred = await readFile(new URL("app/components/deferred-listing-map.tsx", root), "utf8");
  assert.match(deferred, /Failed to fetch dynamically imported module/);
  assert.match(deferred, /MAP_ASSET_RECOVERY_WINDOW_MS = 60_000/);
  assert.match(deferred, /window\.sessionStorage\.setItem\(MAP_ASSET_RECOVERY_KEY, String\(Date\.now\(\)\)\)/);
  assert.match(deferred, /window\.location\.reload\(\)/);
  assert.match(deferred, /window\.sessionStorage\.removeItem\(MAP_ASSET_RECOVERY_KEY\)/);
});

test("map code warms on intent and Leaflet loading overlaps the deferred chunk", async () => {
  const [deferred, listing, vacation, events, hourly, worlds, attractions, styles] = await Promise.all([
    readFile(new URL("app/components/deferred-listing-map.tsx", root), "utf8"),
    readFile(new URL("app/components/listing-map.tsx", root), "utf8"),
    readFile(new URL("app/search/page.tsx", root), "utf8"),
    readFile(new URL("app/events/search/page.tsx", root), "utf8"),
    readFile(new URL("app/components/hourly-results.tsx", root), "utf8"),
    readFile(new URL("app/components/world-map-results.tsx", root), "utf8"),
    readFile(new URL("app/attractions/attractions-explorer.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(deferred, /export const preloadListingMap/);
  assert.match(deferred, /module\.preloadLeaflet\(\)/);
  assert.match(deferred, /טוענים את המפה/);
  assert.match(listing, /export function preloadLeaflet/);
  assert.match(listing, /leafletModulePromise \?\?= import\("leaflet"\)/);
  assert.match(listing, /void leaflet\.then/);
  for (const source of [vacation, events, hourly, worlds, attractions]) {
    assert.match(source, /onPointerEnter=\{preloadListingMap\}/);
    assert.match(source, /onFocus=\{preloadListingMap\}/);
  }
  assert.match(styles, /map-deferred-loading__orbit/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("discovery cards keep equal geometry and consistent primary actions", async () => {
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(styles, /\.discovery-card \{[^}]*height: 100%;[^}]*display: flex;[^}]*flex-direction: column;/s);
  assert.match(styles, /\.discovery-card__body \{[^}]*flex: 1 1 auto;[^}]*display: flex;[^}]*flex-direction: column;/s);
  assert.match(styles, /\.discovery-card footer \{[^}]*margin-top: auto;/s);
  assert.match(styles, /\.discovery-card__details \{[^}]*min-width: 132px;[^}]*min-height: 44px;/s);
});

test("below-fold media does not compete with the first screen", async () => {
  const [home, page, property, discovery, previewGallery] = await Promise.all([
    readFile(new URL("app/components/home-showcase.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/components/property-card.tsx", root), "utf8"),
    readFile(new URL("app/components/discovery-card.tsx", root), "utf8"),
    readFile(new URL("app/components/preview-card-gallery.tsx", root), "utf8"),
  ]);
  assert.match(home, /preload="none"/);
  for (const source of [home, page, property]) assert.match(source, /loading="lazy"/);
  assert.match(discovery, /PreviewCardGallery/);
  assert.match(previewGallery, /loading=\{priority \? "eager" : "lazy"\}/);
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
  assert.match(layout, /publicVacationSearchProperties\([^)]*[\s\S]*?, 1\)/);
  assert.match(layout, /\.slice\(0, 60\)/);
  assert.match(layout, /complete=\{false\}/);
  assert.match(layout, /bundledPublicCatalogSummaries/);
  assert.doesNotMatch(layout, /publicCatalogSummaries<Property>/);
  assert.match(search, /displayedResults\.slice\(0, visibleResultCount\)/);
  assert.match(projection, /imageLimit = 5/);
  assert.doesNotMatch(projection, /sourceUrl/);
  assert.match(search, /displayedResults\.slice\(0, visibleResultCount\)/);
  assert.match(search, /totalCount=\{displayedResults\.length\}/);
  assert.match(progressive, /onShowMore/);
});

test("cold public documents do not read whole runtime catalogs before sending HTML", async () => {
  const [home, business, spas, search] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/business/page.tsx", root), "utf8"),
    readFile(new URL("app/spas/page.tsx", root), "utf8"),
    readFile(new URL("app/search/layout.tsx", root), "utf8"),
  ]);
  for (const source of [home, business, spas, search]) {
    assert.match(source, /bundledPublicCatalogSummaries/);
    assert.doesNotMatch(source, /publicCatalogSummaries</);
  }
  assert.match(business, /publicCatalogSelectedSummaries/);
  assert.match(business, /publicCatalogDetail/);
});

test("spa and hourly place pages select one accepted supplier instead of reading a whole runtime catalog", async () => {
  const source = await readFile(new URL("app/discover/place/[id]/page.tsx", root), "utf8");
  assert.match(source, /cache\(async \(id: string\)/);
  assert.match(source, /publicCatalogSelectedSummaries<SpaPlusSite>/);
  assert.match(source, /publicCatalogSelectedSummaries<\(typeof hourlyCatalog\.places\)\[number\]>/);
  assert.match(source, /bundledPublicCatalogSummaries<SpaPlusSite>/);
  assert.doesNotMatch(source, /publicCatalogSummaries</);
});

test("event search serializes a bounded discovery projection", async () => {
  const [layout, projection] = await Promise.all([
    readFile(new URL("app/events/search/layout.tsx", root), "utf8"),
    readFile(new URL("app/lib/public-event-search.ts", root), "utf8"),
  ]);
  assert.match(layout, /publicEventSearchPlaces\([^)]*[\s\S]*?, 1\)/);
  assert.match(projection, /imageLimit = 5/);
  assert.match(projection, /description: ""/);
  assert.doesNotMatch(projection, /roomOptions|dailyAvailability|dateQuotes|reviewHighlights/);
});

test("catalog refresh and public discovery caching preserve last-good content", async () => {
  const [catalog, clientCache, homeDeals, spaDeals] = await Promise.all([
    readFile(new URL("app/lib/use-published-catalog.ts", root), "utf8"),
    readFile(new URL("app/lib/discovery-client-cache.ts", root), "utf8"),
    readFile(new URL("app/api/vii/home-deals/route.ts", root), "utf8"),
    readFile(new URL("app/api/spa/deals/route.ts", root), "utf8"),
  ]);
  assert.match(catalog, /if \(!hasAcceptedContent\.current\) setItems\(\[\]\)/);
  assert.match(catalog, /hasAcceptedContent\.current = true/);
  assert.match(catalog, /requestIdleCallback/);
  assert.match(catalog, /seed === null \|\| !seedComplete/);
  assert.match(catalog, /setError\(!hasAcceptedContent\.current\)/);
  assert.match(clientCache, /method === "GET" \? "default" : "no-store"/);
  assert.match(homeDeals, /public, max-age=60, s-maxage=300, stale-while-revalidate=86400/);
  assert.match(homeDeals, /status: 503, headers: .*noStore/s);
  assert.match(spaDeals, /Cache-Control": "no-store"/);
});

test("streamed sliders normalize their initial boundary before observers publish controls", async () => {
  const controls = await readFile(new URL("app/components/slider-rail-controls.tsx", root), "utf8");
  assert.match(controls, /rail\.scrollLeft = 0;\s*update\(\);\s*const resizeObserver/);
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

test("homepage warmup starts immediately without waiting for an idle window", async () => {
  const warmup = await readFile(new URL("app/components/smart-navigation-warmup.tsx", root), "utf8");
  assert.match(warmup, /router\.prefetch\(home\)/);
  assert.doesNotMatch(warmup, /requestIdleCallback|setTimeout\(warm/);
  assert.match(warmup, /connection\?\.saveData/);
  assert.match(warmup, /effectiveType === "2g"/);
});

test("internal destinations warm on real pointer, focus or touch intent", async () => {
  const warmup = await readFile(new URL("app/components/smart-navigation-warmup.tsx", root), "utf8");
  assert.match(warmup, /document\.addEventListener\("pointerover"/);
  assert.match(warmup, /document\.addEventListener\("focusin"/);
  assert.match(warmup, /document\.addEventListener\("touchstart"/);
  assert.match(warmup, /router\.prefetch\(destination\)/);
  assert.match(warmup, /saveData/);
  assert.match(warmup, /warmed\.size > 24/);
  assert.match(warmup, /\^\\\/\(\?:admin\|account\|favorites\|booking\)/);
});

test("homepage keeps rated-place details outside the critical world-summary boundary", async () => {
  const home = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(home, /async function HomeCatalogShowcase\(\)/);
  assert.match(home, /async function HomeRatings\(\)/);
  assert.match(home, /<Suspense fallback=\{<HomeCatalogLoading \/>\}><HomeCatalogShowcase \/><\/Suspense>/);
  assert.match(home, /<Suspense fallback=\{null\}><HomeRatings \/><\/Suspense>/);
  assert.doesNotMatch(home, /hourlyCatalogPlaces, ratedPlaces\] = await Promise\.all/);
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
  assert.match(showcase, /href=\{item\.href\}[\s\S]*?prefetch=\{false\}/);
  assert.match(deals, /href=\{localizedPath\(searchHref, language\)\} prefetch=\{false\}/);
  assert.doesNotMatch(switcher, /world-dock__prehydrate|globalSearchHref/);
});

test("homepage destination cards acknowledge the click and warm only on intent", async () => {
  const [showcase, styles, loading] = await Promise.all([
    readFile(new URL("app/components/home-showcase.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/vacations/[region]/loading.tsx", root), "utf8"),
  ]);
  assert.match(showcase, /onPointerEnter=\{\(\) => warmDestination\(item\.href\)\}/);
  assert.match(showcase, /router\.prefetch\(href\)/);
  assert.match(showcase, /aria-busy=\{isPending\}/);
  assert.match(showcase, /data-global-feedback="true"/);
  assert.match(showcase, /waiting: "רק רגע, כבר נכנסים"/);
  assert.match(styles, /\.home-vacation-card__pending/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /title: "מכינים לכם את המקומות באזור"/);
});
