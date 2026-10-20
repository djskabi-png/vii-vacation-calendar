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
  assert.match(warmer, /now\.getTime\(\) \+ 86_400_000/);
  assert.match(warmer, /status: "unavailable"/);
  assert.match(warmer, /if \(!warmed\.some\(item => item\.count > 0\)\)/);
  assert.match(worker, /scheduledTime \/ 60_000\) % 30 === 0[\s\S]*warmVacationDiscoveryCache/);
  assert.match(mcp, /warmVacationDiscoveryCache\(db\)/);
  assert.match(rail, /lastGoodData\.current \? "ready"/);
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

test("card galleries advance past broken supplier images before showing the neutral fallback", async () => {
  const [gallery, hook, loader, css] = await Promise.all([
    read("app/components/preview-card-gallery.tsx"),
    read("app/components/use-preview-gallery.tsx"),
    read("app/lib/preview-image-loader.ts"),
    read("app/globals.css"),
  ]);
  assert.match(gallery, /onError=\{\(\) => \{[\s\S]*setBrokenImages\(previous => new Set\(previous\)\.add\(currentImage\)\)[\s\S]*setImageIndex\(imageIndex \+ 1\)/);
  assert.match(hook, /findReadyPreviewImage\(imagesRef\.current, target, direction\)/);
  assert.match(loader, /for \(let index = startIndex; index >= 0 && index < images\.length; index \+= direction\)/);
  assert.match(gallery, /preview-card-gallery__missing/);
  assert.match(css, /\.preview-card-gallery__missing \{[^}]*position:absolute;[^}]*place-items:center/);
});

test("public deal rails do not print cache implementation notes", async () => {
  for (const path of ["app/components/home-live-deals.tsx", "app/components/spa-package-deals.tsx", "app/components/holiday-live-deals.tsx"]) {
    const source = await read(path);
    assert.doesNotMatch(source, /discoveryCacheCopy|ההצעות מהבדיקה האחרונה/);
  }
});
