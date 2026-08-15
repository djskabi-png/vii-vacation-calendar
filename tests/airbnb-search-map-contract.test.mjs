import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("map changes results only after an explicit search-this-area action", () => {
  const map = read("app/components/listing-map.tsx");
  assert.match(map, /searchArea: "חיפוש באזור הזה"/);
  assert.match(map, /onVisiblePlaceIdsChange\?: \(ids: string\[\]\) => void/);
  assert.match(map, /visiblePlaceIdsCallback\.current\?\.\(pendingVisibleIds\)/);
  assert.match(map, /map\.on\("dragend", \(\) => \{[\s\S]*?reportVisiblePlaces\(true\);[\s\S]*?\}\)/);
  assert.match(map, /map\.on\("zoomend", \(\) => \{[\s\S]*?renderMarkers\(\);[\s\S]*?reportVisiblePlaces\(true\);[\s\S]*?\}\)/);
  assert.match(map, /onClick=\{applyVisibleArea\}/);
  assert.match(map, /suppressViewportPrompt\.current = true/);
  assert.match(map, /map\.invalidateSize\(\{ animate: false \}\)/);
  assert.match(map, /focusInitialPlaces\(\)/);
  assert.match(map, /suppressViewportPrompt\.current = false/);
  assert.doesNotMatch(map, /marker\.on\("mouseover"/);
});

test("opening and closing a map clears stale viewport-only results", () => {
  for (const path of [
    "app/search/page.tsx",
    "app/events/search/page.tsx",
    "app/components/hourly-results.tsx",
    "app/attractions/attractions-explorer.tsx",
    "app/components/world-map-results.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /if \(!mapOpen \|\| !mapVisibleIds\) return filtered/);
    assert.match(source, /setMapVisibleIds\(null\)/);
  }
});

test("map selection is keyboard-safe, localized, and responsive", () => {
  const map = read("app/components/listing-map.tsx");
  const styles = read("app/globals.css");
  assert.match(map, /event\.key === "Escape"/);
  assert.match(map, /marker\?\.getElement\(\)\?\.focus\(\)/);
  assert.match(map, /Interactive places map/);
  assert.match(map, /Интерактивная карта мест/);
  assert.match(map, /Carte interactive des lieux/);
  assert.match(styles, /inset-inline-start: 16px/);
  assert.match(styles, /inset-inline: 10px/);
  assert.match(styles, /saturate\(\.76\) contrast\(\.94\) brightness\(1\.06\)/);
});

test("all map result worlds apply viewport ids to their list", () => {
  for (const path of [
    "app/search/page.tsx",
    "app/events/search/page.tsx",
    "app/components/hourly-results.tsx",
    "app/attractions/attractions-explorer.tsx",
    "app/components/world-map-results.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /mapVisibleIds/);
    assert.match(source, /onVisiblePlaceIdsChange=/);
  }
});

test("filter changes create restorable history entries", () => {
  const routerPaths = [
    "app/events/search/page.tsx",
    "app/components/hourly-results.tsx",
    "app/components/world-map-results.tsx",
  ];
  for (const path of routerPaths) {
    const source = read(path);
    assert.match(source, /router\.push/);
    assert.doesNotMatch(source, /history\.replaceState/);
  }
  const nativePaths = [
    "app/attractions/attractions-explorer.tsx",
    "app/trails/trails-explorer.tsx",
    "app/components/provider-results.tsx",
  ];
  for (const path of nativePaths) {
    const source = read(path);
    assert.match(source, /history\.pushState/);
    assert.doesNotMatch(source, /history\.replaceState/);
  }
  assert.match(read("app/search/page.tsx"), /router\.push\(/);
});
