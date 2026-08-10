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
