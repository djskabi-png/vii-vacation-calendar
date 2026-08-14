import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("viewed history is bounded, deduplicated and newest first", async () => {
  const source = await read("app/lib/viewed-items.ts");
  assert.match(source, /vii-viewed-items-v1/);
  assert.match(source, /MAX_VIEWED_ITEMS\s*=\s*60/);
  assert.match(source, /filter\(\(entry\)\s*=>\s*entry\.key\s*!==\s*key\)/);
  assert.match(source, /viewedAt:\s*new Date\(\)\.toISOString\(\).*\.\.\.current/s);
  assert.match(source, /slice\(0,\s*MAX_VIEWED_ITEMS\)/);
});

test("the heart menu exposes saved and viewed destinations with counts", async () => {
  const [header, menu] = await Promise.all([
    read("app/site-header.tsx"),
    read("app/components/saved-viewed-menu.tsx"),
  ]);
  assert.match(header, /<SavedViewedMenu\s*\/>/);
  assert.match(header, /favorites\?view=saved/);
  assert.match(header, /favorites\?view=viewed/);
  assert.match(menu, /readSavedItems/);
  assert.match(menu, /readViewedItems/);
  assert.match(menu, /aria-haspopup="menu"/);
  assert.match(menu, /Escape/);
  assert.match(menu, /addEventListener\("resize", closeOnResize\)/);
});

test("all supported detail worlds record views", async () => {
  const sources = await Promise.all([
    read("app/business/client-page.tsx"),
    read("app/discover/place/client-page.tsx"),
    read("app/events/place/client-page.tsx"),
    read("app/trails/[slug]/page.tsx"),
    read("app/booking/client-page.tsx"),
  ]);
  for (const source of sources) assert.match(source, /ViewedItemTracker/);
  assert.match(sources[4], /props\.offerId/);
  assert.match(sources[4], /viewedOfferParams\.set\("from"/);
});

test("view tracking is committed before fast navigation and composite titles localize by segment", async () => {
  const [tracker, bootstrap, business, discovery, events, trails, page] = await Promise.all([
    read("app/components/viewed-item-tracker.tsx"),
    read("app/components/viewed-item-bootstrap.tsx"),
    read("app/business/page.tsx"),
    read("app/discover/place/[id]/page.tsx"),
    read("app/events/place/[id]/page.tsx"),
    read("app/trails/[slug]/page.tsx"),
    read("app/favorites/page.tsx"),
  ]);
  assert.match(tracker, /useLayoutEffect/);
  assert.match(tracker, /addEventListener\("pageshow", remember\)/);
  assert.match(bootstrap, /vii-viewed-items-v1/);
  assert.match(bootstrap, /data-viewed-item-bootstrap/);
  for (const source of [business, discovery, events, trails]) assert.match(source, /ViewedItemBootstrap/);
  assert.match(page, /function localizeName/);
  assert.match(page, /if \(translated !== name\) return translated/);
  assert.match(page, /name\.split\(","\)/);
  assert.match(page, /localizeName\(item\.name, translate\)/);
});

test("the library supports two modes, world filters and pagination", async () => {
  const page = await read("app/favorites/page.tsx");
  assert.match(page, /PAGE_SIZE\s*=\s*8/);
  assert.match(page, /LibraryMode\s*=\s*"saved"\s*\|\s*"viewed"/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /availableWorlds/);
  assert.match(page, /favorites-pagination/);
  assert.match(page, /clearViewedItems/);
  assert.match(page, /he:\s*\{/);
  assert.match(page, /en:\s*\{/);
  assert.match(page, /ru:\s*\{/);
  assert.match(page, /fr:\s*\{/);
});
