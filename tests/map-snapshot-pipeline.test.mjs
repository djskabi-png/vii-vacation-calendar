import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isWeeklyMapSnapshotWindow, mapSnapshotSourceHash, staticMapRequest } from "../app/lib/map-snapshot-store.ts";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared maps prefer a stored snapshot and use a passive real map on detail fallback", async () => {
  const [map, detail, url, css] = await Promise.all([
    read("app/components/listing-map.tsx"),
    read("app/discover/place/client-page.tsx"),
    read("app/lib/map-snapshot-url.ts"),
    read("app/globals.css"),
  ]);
  assert.match(map, /mapSnapshotPublicUrl\(tone, preview\.id\)/);
  assert.match(map, /useState\(true\)/);
  assert.match(map, /fetch\(snapshotUrl, \{ cache: "force-cache"/);
  assert.match(map, /if \(response\.ok\) setSnapshotUnavailable\(false\)/);
  assert.doesNotMatch(map, /else if \(single\) setEnabled\(true\)/);
  assert.match(map, /const placeFallback = snapshotUnavailable/);
  assert.match(map, /const previewImage = placeFallback \? preview\.image : snapshotUrl/);
  assert.match(map, /\(!snapshotUnavailable \|\| placeFallback\) && <>/);
  assert.match(map, /placeFallback \? fallbackLabel : mapCopy\.preview/);
  assert.match(map, /if \(!placeFallback\) setSnapshotUnavailable\(true\)/);
  assert.match(map, /image\.complete && image\.naturalWidth === 0/);
  assert.match(map, /const \[interactive, setInteractive\] = useState\(autoLoad\)/);
  assert.match(map, /const activateMap = useCallback\(\(\) => \{[\s\S]*setInteractive\(true\);[\s\S]*setEnabled\(true\)/);
  assert.match(map, /scrollWheelZoom: interactive/);
  assert.match(map, /single && mapReady && !interactive[\s\S]*map-passive-activate/);
  assert.match(map, /onClick=\{activateMap\}/);
  assert.match(map, /!enabled[\s\S]*map-preview-card/);
  assert.match(detail, /<DiscoveryMap items=\{\[item\]\} tone=\{item\.world === "spa" \? "spa" : "hourly"\} single \/>/);
  assert.doesNotMatch(detail, /<DiscoveryMap items=\{\[item\]\}[^>]*single autoLoad/);
  assert.match(url, /\/api\/map-snapshot\?world=/);
  assert.match(css, /\.map-preview-image\.is-map-snapshot/);
  assert.match(css, /\.map-preview-attribution/);
  assert.match(css, /\.map-passive-activate/);
});
test("snapshot generator uses approved static image APIs, never headless OSM tile scraping", async () => {
  const store = await read("app/lib/map-snapshot-store.ts");
  assert.match(store, /api\.mapbox\.com\/styles\/v1\/mapbox\/streets-v12\/static/);
  assert.match(store, /api\.maptiler\.com\/maps\/streets-v4\/static/);
  assert.match(store, /attribution=true/);
  assert.match(store, /attribution=bottomright/);
  assert.doesNotMatch(store, /tile\.openstreetmap\.org/);
  assert.doesNotMatch(store, /playwright|puppeteer|headless/i);
});

test("weekly reconciliation is bounded, leased and preserves the prior object on failure", async () => {
  const [store, worker] = await Promise.all([
    read("app/lib/map-snapshot-store.ts"),
    read("worker/index.ts"),
  ]);
  assert.match(store, /status === "ready" && record\.sourceHash === sourceHash && record\.objectKey/);
  assert.match(store, /lease_token=\?, lease_until=\?/);
  assert.match(store, /attempted >= limit/);
  const put = store.indexOf("await bucket.put(objectKey");
  const ready = store.indexOf("SET status='ready'");
  assert.ok(put >= 0 && ready > put, "immutable object must be stored before ready metadata is swapped");
  const failureUpdate = store.match(/SET status='failed', last_error=\?, retry_after=\?, checked_at=\?, lease_until=NULL, lease_token=NULL[\s\S]*?WHERE entity_key=\? AND lease_token=\?/);
  assert.ok(failureUpdate, "failure update must not clear or replace object_key");
  assert.match(store, /parts\.weekday === "Mon" && parts\.hour === "03"/);
  assert.match(worker, /isWeeklyMapSnapshotWindow\(scheduledAt\)[\s\S]*reconcileMapSnapshots/);
});

test("map coverage inventory includes every mapped public world", async () => {
  const catalog = await read("app/lib/map-snapshot-catalog.ts");
  for (const source of ["properties", "eventPlaces", "discoveryItems"]) assert.match(catalog, new RegExp(`\\b${source}\\b`));
  for (const world of ["vacation", "events", "spa", "hourly", "activities"]) assert.match(catalog, new RegExp(`"${world}"`));
  assert.match(catalog, /validCoordinate/);
  assert.match(catalog, /new Map\(/);
});

test("snapshot delivery is server-side, cached and never exposes provider credentials", async () => {
  const [route, store] = await Promise.all([
    read("app/api/map-snapshot/route.ts"),
    read("app/lib/map-snapshot-store.ts"),
  ]);
  assert.match(route, /UPLOADS\.get\(record\.objectKey\)/);
  assert.match(route, /getRequestExecutionContext/);
  assert.match(route, /reconcileMapSnapshots\(\{ db, bucket: env\.UPLOADS, env, candidates: \[candidate\], limit: 1 \}\)/);
  assert.match(route, /"X-VII-Map-Snapshot": candidate \? "warming" : "missing"/);
  assert.match(route, /stale-while-revalidate=2592000/);
  assert.match(route, /ETag/);
  assert.doesNotMatch(route, /MAPBOX_STATIC_TOKEN|MAPTILER_API_KEY/);
  assert.match(store, /provider_not_configured/);
  assert.match(store, /MIN_IMAGE_BYTES/);
  assert.match(store, /MAX_IMAGE_BYTES/);
});

test("provider requests and weekly Israel-time window are deterministic", () => {
  const candidate = { world: "vacation", placeId: "villa-1", name: "Villa", lat: 32.1, lng: 34.8, precision: "exact", zoom: 14 };
  assert.equal(staticMapRequest(candidate, {}), null);
  const mapbox = staticMapRequest(candidate, { VII_STATIC_MAP_PROVIDER: "mapbox", VII_MAPBOX_STATIC_TOKEN: "secret value" });
  assert.equal(mapbox.provider, "mapbox");
  assert.match(mapbox.url, /access_token=secret%20value/);
  assert.match(mapbox.url, /34\.800000,32\.100000,14/);
  const maptiler = staticMapRequest(candidate, { VII_STATIC_MAP_PROVIDER: "maptiler", VII_MAPTILER_API_KEY: "key" });
  assert.equal(maptiler.provider, "maptiler");
  assert.match(maptiler.url, /attribution=bottomright/);
  assert.equal(mapSnapshotSourceHash(candidate, "mapbox"), mapSnapshotSourceHash(candidate, "mapbox"));
  assert.notEqual(mapSnapshotSourceHash(candidate, "mapbox"), mapSnapshotSourceHash({ ...candidate, lat: 32.2 }, "mapbox"));
  assert.equal(isWeeklyMapSnapshotWindow(new Date("2026-10-26T01:45:00.000Z")), true);
  assert.equal(isWeeklyMapSnapshotWindow(new Date("2026-10-26T01:55:00.000Z")), false);
});
