import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("undated online capability is provider-free, refreshed every half hour and never polled by the browser", async () => {
  const [route, capability, client, mcp] = await Promise.all([
    read("app/api/vii/online-capabilities/route.ts"),
    read("app/lib/online-booking-capability.ts"),
    read("app/lib/use-online-capabilities.ts"),
    read("app/mcp/route.ts"),
  ]);
  assert.match(route, /readCachedOnlineCapabilities/);
  assert.doesNotMatch(route, /cachedOnlineCapabilities\(await runtimeCatalogDatabase/);
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
  assert.match(warmer, /freshMs: 30 \* 60_000, staleMs: 30 \* 86_400_000/);
  assert.match(route, /readCachedDiscovery/);
  assert.doesNotMatch(route, /getHomeDeals|supplierToken/);
  assert.match(route, /policy: VACATION_DISCOVERY_POLICY/);
  assert.match(warmer, /for \(const period of homeDealPeriods\)/);
  assert.match(warmer, /key: \["vacation-near", dates\.from, dates\.till, 2\]/);
  assert.match(warmer, /deals\.length > 0/);
  assert.match(warmer, /Array\.from\(\{ length: 7 \}/);
  assert.match(warmer, /status: "unavailable"/);
  assert.match(warmer, /if \(!warmed\.some\(item => item\.count > 0\)\)/);
  assert.match(worker, /scheduledTime \/ 60_000\) % 30 === 0[\s\S]*warmVacationDiscoveryCache/);
  assert.match(mcp, /warmVacationDiscoveryCache\(db\)/);
  assert.match(rail, /const accepted = lastGoodData\.current\.get\(selectionKey\)/);
  assert.match(rail, /setState\(accepted \? "ready" : "loading"\)/);
  assert.match(rail, /lastGoodData\.current\.set\(selectionKey, result\)/);
});

test("event discovery is prewarmed for a rolling week and visitor requests never call the supplier", async () => {
  const [route, warmer, worker, mcp] = await Promise.all([
    read("app/api/vii/live-search/route.ts"),
    read("app/lib/warm-event-discovery-cache.ts"),
    read("worker/index.ts"),
    read("app/mcp/route.ts"),
  ]);
  assert.match(warmer, /freshMs: 30 \* 60_000, staleMs: 30 \* 86_400_000/);
  assert.match(warmer, /offset < 7/);
  assert.match(warmer, /for \(const preset of eventDealPresets\(clock\)\)/);
  assert.match(warmer, /key: \["events-discovery", date, date, guests, "both"\]/);
  assert.match(warmer, /some\(\(offer\) => offer\?\.available === true/);
  assert.match(route, /readCachedDiscovery/);
  assert.doesNotMatch(route, /cachedDiscovery\(/);
  assert.match(worker, /warmVacationDiscoveryCache\(database, scheduledAt\)[\s\S]*warmEventDiscoveryCache\(database, scheduledAt\)/);
  assert.match(mcp, /world === "events"[\s\S]*warmEventDiscoveryCache\(db\)/);
});

test("map cards send only their primary image and room cards own stable media geometry", async () => {
  const [map, detail, css] = await Promise.all([
    read("app/components/listing-map.tsx"),
    read("app/business/client-page.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(map, /images=\{\[selected\.image\]\}/);
  assert.doesNotMatch(map, /images: listing\.images\?\.slice/);
  assert.doesNotMatch(map, /images: item\.images\?\.slice/);
  assert.match(detail, /width="960" height="640"[\s\S]*decoding="async"/);
  assert.doesNotMatch(detail, /room-card__features/);
  assert.match(detail, /property-feature-groups[\s\S]*PropertyHighlightIcon/);
  assert.match(css, /\.room-card \{ min-height: 318px;[\s\S]*grid-template-columns: minmax\(330px, 43%\)/);
});

test("card galleries advance past broken supplier images and withdraw media after complete exhaustion", async () => {
  const [gallery, hook, loader, css] = await Promise.all([
    read("app/components/preview-card-gallery.tsx"),
    read("app/components/use-preview-gallery.tsx"),
    read("app/lib/preview-image-loader.ts"),
    read("app/globals.css"),
  ]);
  assert.match(gallery, /onError=\{\(\) => \{[\s\S]*const failed = new Set\(brokenImages\)\.add\(currentImage\)[\s\S]*setImageIndex\(nextIndex\)/);
  assert.match(hook, /findReadyPreviewImage\(imagesRef\.current, target, direction\)/);
  assert.match(loader, /for \(let index = startIndex; index >= 0 && index < images\.length; index \+= direction\)/);
  assert.match(gallery, /setMediaUnavailable\(true\)/);
  assert.match(gallery, /onMediaUnavailable\?\.\(\)/);
  assert.doesNotMatch(gallery, /preview-card-gallery__missing/);
  assert.match(css, /\.preview-card-gallery__missing \{[^}]*position:absolute;[^}]*place-items:center/);
});

test("business and event detail pages render accepted platform snapshots without live supplier requests", async () => {
  const [business, businessClient, eventQuery, eventPath, eventClient] = await Promise.all([
    read("app/business/page.tsx"),
    read("app/business/client-page.tsx"),
    read("app/events/place/page.tsx"),
    read("app/events/place/[id]/page.tsx"),
    read("app/events/place/client-page.tsx"),
  ]);
  for (const source of [business, eventQuery, eventPath]) {
    assert.match(source, /publicCatalogDetail/);
    assert.doesNotMatch(source, /liveSupplierPlaceDetail/);
  }
  assert.doesNotMatch(businessClient, /import \{[^}]*\bproperties\b[^}]*\} from "\.\.\/data\/site-data"/);
  assert.doesNotMatch(businessClient, /import \{[^}]*\bdiscoveryItems\b[^}]*\} from "\.\.\/data\/world-data"/);
  assert.doesNotMatch(eventClient, /import \{[^}]*\beventPlaces\b[^}]*\} from "\.\.\/\.\.\/data\/site-data"/);
  assert.doesNotMatch(eventClient, /import \{[^}]*\bproviderProfiles\b[^}]*\} from "\.\.\/\.\.\/data\/world-data"/);
});

test("new-tab business navigation warms both app and document caches", async () => {
  const warmup = await read("app/components/smart-navigation-warmup.tsx");
  assert.match(warmup, /isBusinessDepthRoute\(basePath\)/);
  assert.match(warmup, /fetch\(destination,[\s\S]*cache: "force-cache"/);
  assert.match(warmup, /Accept: "text\/html,application\/xhtml\+xml"/);
});

test("public deal rails do not print cache implementation notes", async () => {
  for (const path of ["app/components/home-live-deals.tsx", "app/components/spa-package-deals.tsx", "app/components/holiday-live-deals.tsx"]) {
    const source = await read(path);
    assert.doesNotMatch(source, /discoveryCacheCopy|ההצעות מהבדיקה האחרונה/);
  }
});
