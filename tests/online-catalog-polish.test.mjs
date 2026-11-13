import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import { readMapImplementation } from "./helpers/map-implementation-source.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("undated online capability prefers the durable snapshot and has one explicit-flag live recovery without browser polling", async () => {
  const [route, capability, client, mcp] = await Promise.all([
    read("app/api/vii/online-capabilities/route.ts"),
    read("app/lib/online-booking-capability.ts"),
    read("app/lib/use-online-capabilities.ts"),
    read("app/mcp/route.ts"),
  ]);
  assert.match(route, /readCachedOnlineCapabilities/);
  assert.doesNotMatch(route, /cachedOnlineCapabilities\(await runtimeCatalogDatabase/);
  assert.match(route, /try \{ return await readCachedOnlineCapabilities/);
  assert.match(route, /onlineCapabilitiesFromSearch\(result, now\)/);
  assert.match(route, /rooms: \[\{ adults: 2 \}\]/);
  assert.match(capability, /CAPABILITY_FRESH_MS = 30 \* 60_000/);
  assert.match(capability, /CAPABILITY_MAX_AGE_MS = 30 \* DAY_MS/);
  assert.doesNotMatch(client, /setInterval/);
  assert.match(mcp, /world === "vacations"[\s\S]*cachedOnlineCapabilities\(db\)/);
});

test("vacation discovery keeps last-good rails and the authenticated scheduler warms every near-date period", async () => {
  const [route, warmer, worker, mcp, rail] = await Promise.all([
    read("app/api/vii/home-deals/route.ts"),
    read("app/lib/warm-vacation-discovery-cache.ts"),
    read("worker/index.ts"),
    read("app/mcp/route.ts"),
    read("app/components/home-live-deals.tsx"),
  ]);
  assert.match(warmer, /freshMs: 5 \* 60_000, staleMs: 60 \* 60_000/);
  assert.match(route, /readCachedDiscovery/);
  assert.doesNotMatch(route, /getHomeDeals|supplierToken/);
  assert.match(route, /policy: VACATION_DISCOVERY_POLICY/);
  assert.match(warmer, /const orderedPeriods = \["tomorrow", \.\.\.homeDealPeriods/);
  assert.match(warmer, /for \(const period of orderedPeriods\)/);
  assert.match(warmer, /key: \["vacation-near", dates\.from, dates\.till, 2\]/);
  assert.match(warmer, /count: cached\.value\.deals\.length/);
  assert.doesNotMatch(warmer, /Array\.from\(\{ length: 7 \}/);
  assert.match(warmer, /status: "unavailable"/);
  assert.match(warmer, /warmed\.push\(\{ period,/);
  assert.doesNotMatch(worker, /scheduledTime \/ 60_000\) % 30 === 0/);
  assert.match(worker, /warmVacationDiscoveryCache\(database, scheduledAt\)/);
  assert.match(mcp, /warmVacationDiscoveryCache\(db\)/);
  assert.match(rail, /const acceptedCandidate = lastGoodData\.current\.get\(selectionKey\)/);
  assert.match(rail, /isFreshHomeOffer\(acceptedCandidate\)/);
  assert.match(rail, /setState\(accepted \? "ready" : "loading"\)/);
  assert.match(rail, /lastGoodData\.current\.set\(selectionKey, result\)/);
});

test("event discovery is prewarmed for a rolling week and cold recovery uses the shared bounded loader", async () => {
  const [route, warmer, worker, mcp] = await Promise.all([
    read("app/api/vii/live-search/route.ts"),
    read("app/lib/warm-event-discovery-cache.ts"),
    read("worker/index.ts"),
    read("app/mcp/route.ts"),
  ]);
  assert.match(warmer, /EVENT_DISCOVERY_POLICY/);
  assert.match(warmer, /offset < 7/);
  assert.match(warmer, /for \(const preset of eventDealPresets\(clock\)\)/);
  assert.match(warmer, /eventDiscoveryKey\(date, guests\)/);
  assert.match(warmer, /validate: (?:validEventDiscoveryResult|eventDiscoveryValidator\(date, guests\))/);
  assert.match(warmer, /results\.filter\(\(offer\) => offer\.available === true\)\.length/);
  assert.match(route, /readCachedDiscovery/);
  assert.match(route, /accepted\?\.cache\.status === "fresh" \? accepted : await cachedDiscovery/);
  assert.match(route, /load: \(\) => loadEventDiscovery\(\{ date: body\.from as string, guests: Number\(body\.guests\), token, publishedIds: publicIds \}\)/);
  assert.doesNotMatch(route, /\/calendar|Promise\.all\(.*publicIds/);
  assert.match(worker, /warmVacationDiscoveryCache\(database, scheduledAt\)[\s\S]*warmEventDiscoveryCache\(database, scheduledAt\)/);
  assert.match(mcp, /world === "events"[\s\S]*warmEventDiscoveryCache\(db\)/);
});

test("map cards send only their primary image and room cards own stable media geometry", async () => {
  const [map, detail, css] = await Promise.all([
    readMapImplementation(),
    read("app/business/client-page.tsx"),
    readEffectiveWorldCss(),
  ]);
  assert.match(map, /images=\{\[selected\.image\]\}/);
  assert.doesNotMatch(map, /images: listing\.images\?\.slice/);
  assert.doesNotMatch(map, /images: item\.images\?\.slice/);
  assert.match(detail, /width="960" height="640"[\s\S]*decoding="async"/);
  assert.doesNotMatch(detail, /room-card__features/);
  assert.match(detail, /<UnifiedAmenityList items=\{propertyAmenities\} \/>/);
  assert.doesNotMatch(detail, /property-feature-groups|modal-feature-groups/);
  assert.match(css, /\.room-card \{ min-height: 318px;[\s\S]*grid-template-columns: minmax\(330px, 43%\)/);
});

test("card galleries advance past broken supplier images and withdraw media after complete exhaustion", async () => {
  const [gallery, hook, loader, css] = await Promise.all([
    read("app/components/preview-card-gallery.tsx"),
    read("app/components/use-preview-gallery.tsx"),
    read("app/lib/preview-image-loader.ts"),
    readEffectiveWorldCss(),
  ]);
  assert.match(gallery, /onOriginalFailure=\{\(\) => \{[\s\S]*const failed = new Set\(brokenImages\)\.add\(currentImage\)[\s\S]*setImageIndex\(nextIndex\)/);
  assert.match(hook, /findReadyPreviewImage\(imagesRef\.current, target, direction,[\s\S]*?loadPreviewImage\(src\)/);
  assert.match(loader, /for \(let index = startIndex; index >= 0 && index < images\.length; index \+= direction\)/);
  assert.match(gallery, /galleryImages\.every\(\(image\) => brokenImages\.has\(image\)\)/);
  assert.match(gallery, /onMediaUnavailable\?\.\(\)/);
  assert.doesNotMatch(gallery, /preview-card-gallery__missing/);
  assert.match(css, /\.preview-card-gallery__missing \{[^}]*position:absolute;[^}]*place-items:center/);
});

test("business and event detail pages stream accepted build shells and defer current detail enrichment", async () => {
  const [business, businessClient, eventQuery, eventPath, eventClient] = await Promise.all([
    read("app/business/page.tsx"),
    read("app/business/client-page.tsx"),
    read("app/events/place/page.tsx"),
    read("app/events/place/[id]/page.tsx"),
    read("app/events/place/client-page.tsx"),
  ]);
  for (const source of [business, eventQuery, eventPath]) {
    assert.doesNotMatch(source, /publicCatalogDetail/);
    assert.match(source, /bundledPublicCatalogSelectedSummaries/);
    assert.match(source, /supplierDetailUrl/);
    assert.doesNotMatch(source, /liveSupplierPlaceDetail/);
  }
  assert.match(eventQuery, /const relatedContent = <Suspense fallback=\{null\}>[\s\S]*EventRelatedContent/);
  assert.match(eventQuery, /async function EventRelatedContent[\s\S]*bundledPlaces/);
  assert.match(eventPath, /const relatedContent = <Suspense fallback=\{null\}>[\s\S]*EventRelatedSlotAsync/);
  assert.match(eventPath, /async function EventRelatedSlotAsync[\s\S]*bundledEventPlaces/);
  assert.doesNotMatch(eventQuery, /relatedPlaces = nearbyRecommendations/);
  assert.doesNotMatch(eventPath, /relatedPlaces = nearbyRecommendations/);
  assert.doesNotMatch(businessClient, /import \{[^}]*\bproperties\b[^}]*\} from "\.\.\/data\/site-data"/);
  assert.doesNotMatch(businessClient, /import \{[^}]*\bdiscoveryItems\b[^}]*\} from "\.\.\/data\/world-data"/);
  assert.doesNotMatch(eventClient, /import \{[^}]*\beventPlaces\b[^}]*\} from "\.\.\/\.\.\/data\/site-data"/);
  assert.doesNotMatch(eventClient, /import \{[^}]*\bproviderProfiles\b[^}]*\} from "\.\.\/\.\.\/data\/world-data"/);
});

test("new-tab business navigation warms only the bounded document path", async () => {
  const warmup = await read("app/components/smart-navigation-warmup.tsx");
  const scheduler = await read("app/lib/navigation-intent-warmup.ts");
  assert.match(warmup, /isBusinessDepthRoute\(basePath\)/);
  assert.match(warmup, /warmup\.warm\(destination, !mobileSameTab && \(opensNewTab \|\| isBusinessDepthRoute\(basePath\)\)\)/);
  assert.match(scheduler, /cache: "force-cache"/);
  assert.match(scheduler, /Accept: "text\/html,application\/xhtml\+xml"/);
});

test("public deal rails do not print cache implementation notes", async () => {
  for (const path of ["app/components/home-live-deals.tsx", "app/components/spa-package-deals.tsx", "app/components/holiday-live-deals.tsx", "app/components/event-last-minute.tsx"]) {
    const source = await read(path);
    assert.doesNotMatch(source, /discoveryCacheCopy|staleLabel|ההצעות מהבדיקה האחרונה|הזמינות מוצגת מהבדיקה האחרונה/);
  }
});
