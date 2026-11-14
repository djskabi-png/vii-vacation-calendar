import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import { readMapImplementation } from "./helpers/map-implementation-source.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isWeeklyMapSnapshotWindow, mapSnapshotSourceHash, staticMapRequest } from "../app/lib/map-snapshot-store.ts";
import { buildMapSnapshotCandidates, validSnapshotCoordinate } from "../app/lib/map-snapshot-candidates.ts";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared maps prefer a stored snapshot and use a passive real map on detail fallback", async () => {
  const [map, detail, url, css] = await Promise.all([
    readMapImplementation(),
    read("app/discover/place/client-page.tsx"),
    read("app/lib/map-snapshot-url.ts"),
    readEffectiveWorldCss(),
  ]);
  assert.match(map, /mapSnapshotPublicUrl\(tone, preview\.id\)/);
  assert.match(map, /useState\(true\)/);
  assert.match(map, /fetch\(snapshotProbeUrl, \{ cache: "force-cache"/);
  assert.match(map, /response\.headers\.get\("X-VII-Map-Snapshot"\) === "ready"/);
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
  assert.match(detail, /<DeferredDiscoveryMap items=\{\[item\]\} tone=\{item\.world === "spa" \? "spa" : "hourly"\} single \/>/);
  assert.doesNotMatch(detail, /<DeferredDiscoveryMap items=\{\[item\]\}[^>]*single autoLoad/);
  assert.match(url, /\/api\/map-snapshot\?world=/);
  assert.match(url, /&probe=1/);
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
  assert.match(catalog, /validSnapshotCoordinate/);
  const candidates = await read("app/lib/map-snapshot-candidates.ts");
  assert.match(candidates, /new Map\(/);
});

test("snapshot delivery is server-side, cached and never exposes provider credentials", async () => {
  const [route, store] = await Promise.all([
    read("app/api/map-snapshot/route.ts"),
    read("app/lib/map-snapshot-store.ts"),
  ]);
  assert.match(route, /UPLOADS\.get\(record\.objectKey\)/);
  assert.match(route, /UPLOADS\.head\(record\.objectKey\)/);
  assert.match(route, /status: probe \? 204 : 404/);
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

test("snapshot catalog rejects null-island and preserves explicit coordinate provenance", () => {
  assert.equal(validSnapshotCoordinate(0, 0), false);
  assert.equal(validSnapshotCoordinate(undefined, 35), false);
  assert.equal(validSnapshotCoordinate(32.1, 34.8), true);
  const candidates = buildMapSnapshotCandidates({
    properties: [
      { slug: "legacy", name: "Legacy", lat: 32, lng: 35 },
      { slug: "area-stay", name: "Area stay", lat: 32, lng: 35, mapPrecision: "area" },
      { slug: "exact-stay", name: "Exact stay", lat: 32, lng: 35, mapPrecision: "exact" },
      ...[{ lat: 0, lng: 0 }, { lat: NaN, lng: 35 }, { lat: 91, lng: 35 }, { lat: 32, lng: 181 }, { lat: 32 }].map((coordinate,index)=>({slug:`invalid-${index}`,name:"Invalid coordinate",...coordinate})),
    ],
    eventPlaces: [{ slug: "area-event", name: "Area", lat: 32, lng: 35, mapPrecision: "area" }],
    discoveryItems: [
      { id: "unmarked", world: "spa", name: "Unmarked", lat: 32, lng: 35 },
      { id: "exact", world: "spa", name: "Exact", lat: 32, lng: 35, mapPrecision: "exact" },
    ],
  });
  assert.equal(candidates.find((candidate) => candidate.placeId === "legacy")?.precision, "exact");
  assert.equal(candidates.find((candidate) => candidate.placeId === "area-stay")?.zoom, 12);
  assert.equal(candidates.find((candidate) => candidate.placeId === "exact-stay")?.zoom, 14);
  assert.equal(candidates.some(candidate=>candidate.placeId.startsWith("invalid-")),false);
  assert.equal(candidates.length,6);
  assert.equal(candidates.find((candidate) => candidate.placeId === "area-event")?.precision, "area");
  assert.equal(candidates.find((candidate) => candidate.placeId === "unmarked")?.precision, "area");
  assert.equal(candidates.find((candidate) => candidate.placeId === "exact")?.precision, "exact");
});

test("provider changes and authorized forced reconciliation can recover failed snapshots immediately", async () => {
  const store = await read("app/lib/map-snapshot-store.ts");
  assert.match(store, /retry_after=CASE WHEN vii_map_snapshots_v1\.source_hash<>excluded\.source_hash THEN NULL/);
  assert.match(store, /last_error=CASE WHEN vii_map_snapshots_v1\.source_hash<>excluded\.source_hash THEN NULL/);
  assert.match(store, /!options\.force && Number\.isFinite\(retryAt\)/);
  const route = await read("app/api/admin/map-snapshots/route.ts");
  assert.match(route, /authorizedAdminSession/);
  assert.match(route, /force: true/);
  assert.match(route, /providerConfigured/);
});
