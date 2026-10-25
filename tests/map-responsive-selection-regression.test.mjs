import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("open map switches its scroll lock in both responsive directions", () => {
  const hook = read("app/components/map-view-state.ts");
  assert.match(hook, /if \(event\.matches\) unlockPage\(\);\s*else lockPage\(\)/);
  assert.match(hook, /lockedStyles\.current\) return/);
  assert.match(hook, /body\.style\.position = "fixed"/);
  assert.match(hook, /body\.style\.position = styles\.bodyPosition/);
  assert.match(hook, /map-selection-card/);
  assert.match(hook, /event\.defaultPrevented/);
});

test("desktop map opening reveals the map and closing returns to the original position", () => {
  const hook = read("app/components/map-view-state.ts");
  assert.match(hook, /querySelector<HTMLElement>\("\.map-results-experience"\)/);
  assert.match(hook, /window\.scrollTo\(\{ top, behavior \}\)/);
  assert.match(hook, /prefers-reduced-motion: reduce/);
  assert.match(hook, /setTimeout\(\(\) => scrollDesktopMapIntoView\("auto"\), 620\)/);
  assert.match(hook, /window\.scrollTo\(0, scrollPosition\.current\)/);
  assert.match(read("app/globals.css"), /\.map-results-experience \{[^}]*scroll-margin-top: 92px/);
});

test("a dense cluster expands immediately instead of requiring another zoom cycle", () => {
  const map = read("app/components/listing-map.tsx");
  assert.match(map, /if \(clusterDistance < 120 \|\| targetZoom <= currentZoom\) \{\s*\/\/[\s\S]*?spiderfyCluster\(cluster\.entries, clusterCenter\);/);
  assert.match(map, /map\.panInside\(clusterCenter, \{ padding: L\.point\(120, 120\), animate: true \}\)/);
});

test("map canvas resizes without resetting the user's camera", () => {
  const map = read("app/components/listing-map.tsx");
  const resize = map.slice(map.indexOf("resizeObserver = new ResizeObserver"), map.indexOf("resizeObserver.observe(container)"));
  assert.match(resize, /invalidateSize\(\{ animate: false, pan: false \}\)/);
  assert.doesNotMatch(resize, /fitBounds|focusInitialPlaces|setView/);
  assert.doesNotMatch(resize, /renderMarkers\(\)/);
  assert.match(map, /resizeObserver\?\.disconnect\(\)/);
  assert.match(map, /window\.cancelAnimationFrame\(resizeFrame\)/);
});

test("selection and background close update the reciprocal state", () => {
  const map = read("app/components/listing-map.tsx");
  assert.match(map, /setSelectedId\(id\);\s*activePlaceCallback\.current\?\.\(id\)/);
  assert.match(map, /map\.on\("click", \(\) => \{[\s\S]*?setSelectedId\(""\);[\s\S]*?activePlaceCallback\.current\?\.\(null\)/);
  assert.match(map, /mapInstance\.current\.panInside/);
  assert.match(map, /prefers-reduced-motion: reduce/);
});

test("regional trail map uses truthful media and returns actual trail IDs to the list", () => {
  const map = read("app/components/listing-map.tsx");
  assert.match(map, /illustrativeImage: true/);
  assert.match(map, /images\/trails\/\$\{areaTrails\[0\]\.slug\}/);
  assert.match(map, /precision === "area"/);
  assert.match(map, /groups\.has\(`trails-\$\{trail\.mainArea\}`\)/);
  assert.match(map, /onVisiblePlaceIdsChange\?\.\(ids\)/);
});

test("a genuinely empty map viewport is not reported as the whole catalog", () => {
  for (const path of ["app/components/hourly-results.tsx", "app/trails/trails-explorer.tsx"]) {
    assert.doesNotMatch(read(path), /visibleMapCount\s*\|\|/);
  }
});

test("a newly expanded place accepts the first keyboard action or new tap", () => {
  const map = read("app/components/listing-map.tsx");
  assert.doesNotMatch(map, /selectionReadyAt|performance\.now\(\) \+ 300/);
  assert.match(map, /event\.originalEvent === clusterActivationEvent/);
  assert.match(map, /clusterActivationEvent = event\.originalEvent/);
});

test("keyboard focus cannot scroll the map's clipping frame", () => {
  // overflow:hidden permits programmatic focus scrolling. That moved the
  // actual map canvas 91px upward while its full-screen frame stayed at y=0.
  const css = read("app/globals.css");
  assert.match(css, /\.listing-map-shell \{[^}]*overflow: hidden; overflow: clip;/);
});

test("panning preserves marker DOM and readiness follows initial layout", () => {
  const map = read("app/components/listing-map.tsx");
  assert.doesNotMatch(map, /map\.on\("moveend",[\s\S]*?renderMarkers\(\)/);
  assert.match(map, /if \(!cancelled && layoutReady\) setMapReady\(true\)/);
  assert.match(map, /layoutReady = true;\s*if \(tilesReady\) setMapReady\(true\)/);
});

test("late price and review data refresh markers without rebuilding Leaflet", () => {
  const map = read("app/components/listing-map.tsx");
  assert.match(map, /const currentPlaces = placesRef\.current;[\s\S]*?currentPlaces\.forEach/);
  assert.match(map, /renderMarkersRef\.current = renderMarkers/);
  assert.match(map, /renderMarkersRef\.current\?\.\(\);[\s\S]*?\[placesSignature\]/);
  const mainEffectDependencies = map.match(/\}, \[enabled, interactive, ([^\]]+)\]\);/)?.[1] ?? "";
  assert.doesNotMatch(mainEffectDependencies, /(^|,\s*)places(,|$)/);
  assert.doesNotMatch(mainEffectDependencies, /placesGeometrySignature|focusKey/);
});

test("regional map copy is localized and topic filters survive its place-card link", () => {
  const map = read("app/components/listing-map.tsx");
  assert.match(map, /const \{ language \} = useSiteLanguage\(\)/);
  assert.match(map, /Trails in this area/);
  assert.match(map, /Маршрутов в этом районе/);
  assert.match(map, /Itinéraires dans cette zone/);
  assert.match(map, /\["nature", "difficulty", "q"\]/);
  assert.match(map, /regional \? regionsCopy : cardCopy\.visible/);
  assert.equal((map.match(/href=\{localizedPath\(selected\.href, language\)\}/g) || []).length, 2,
    "Both map-card navigation targets must localize React props, not only mutated DOM attributes");
  assert.match(map, /\$\{listing\.guests\} \$\{units\.guests\}/,
    "Leaflet event icons need native localized labels before DOM translation");
  assert.doesNotMatch(read("app/globals.css"), /\.map-selection-card__body a \{ min-height: 42px/);
});
