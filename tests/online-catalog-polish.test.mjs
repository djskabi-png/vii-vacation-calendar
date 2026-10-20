import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("undated online capability is provider-free, weekly and never polled by the browser", async () => {
  const [route, capability, client, mcp] = await Promise.all([
    read("app/api/vii/online-capabilities/route.ts"),
    read("app/lib/online-booking-capability.ts"),
    read("app/lib/use-online-capabilities.ts"),
    read("app/mcp/route.ts"),
  ]);
  assert.match(route, /readCachedOnlineCapabilities/);
  assert.doesNotMatch(route, /cachedOnlineCapabilities\(await runtimeCatalogDatabase/);
  assert.match(capability, /CAPABILITY_FRESH_MS = 7 \* DAY_MS/);
  assert.doesNotMatch(client, /setInterval/);
  assert.match(mcp, /world === "vacations"[\s\S]*cachedOnlineCapabilities\(db\)/);
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

test("public deal rails do not print cache implementation notes", async () => {
  for (const path of ["app/components/home-live-deals.tsx", "app/components/spa-package-deals.tsx", "app/components/holiday-live-deals.tsx"]) {
    const source = await read(path);
    assert.doesNotMatch(source, /discoveryCacheCopy|ההצעות מהבדיקה האחרונה/);
  }
});
