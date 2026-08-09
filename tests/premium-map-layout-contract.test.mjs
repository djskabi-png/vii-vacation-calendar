import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("desktop map uses the full canvas without a narrow result rail", () => {
  assert.doesNotMatch(component, /map-results-rail|map-results-scroll|map-result-card|data-map-result-id/);
  assert.doesNotMatch(styles, /\.map-results-rail|\.map-results-scroll|\.map-result-card|\.map-result-select/);
  assert.match(component, /<div className="map-results-canvas">\{mapCanvas\}<\/div>/);
  assert.match(styles, /\.map-results-experience \{[^}]*overflow: hidden;[^}]*border-radius: 24px/);
  assert.match(component, /marker\.on\("click", \(\) => selectPlace\(place\.id\)\)/);
});

test("place cards open only after marker activation and use a quiet modern basemap", () => {
  assert.match(component, /const initialSelectedId = single \?/);
  assert.doesNotMatch(component, /\.on\("mouseover", \(\) => setSelectedId/);
  assert.doesNotMatch(component, /\.on\("focus", \(\) => setSelectedId/);
  assert.match(component, /marker\.on\("click", \(\) => selectPlace/);
  assert.match(component, /const selectionReadyAt = performance\.now\(\) \+ 300/);
  assert.match(component, /if \(performance\.now\(\) < selectionReadyAt\) return/);
  assert.match(component, /if \(clustered\) \{[\s\S]*marker\.on\("click", \(\) => \{[\s\S]*setSelectedId\(""\)/);
  assert.doesNotMatch(component, /title: entry\.name|title: clustered \?/);
  assert.match(component, /basemaps\.cartocdn\.com\/rastertiles\/voyager/);
  assert.match(styles, /\.listing-map-shell \.leaflet-tile-pane \{ filter: saturate\(1\.08\) contrast\(1\.02\); \}/);
});

test("useful numeric labels appear on markers while generic places keep icons", () => {
  assert.match(component, /const useTextLabel = clustered \|\| \/\\d\/\.test\(place\.markerLabel\)/);
});

test("tightly overlapping clusters expand into individually selectable spider markers", () => {
  assert.match(component, /const spiderfyCluster = \(entries: MapPlace\[\], center:/);
  assert.match(component, /spiderfyCluster\(cluster\.entries, clusterCenter\)/);
  assert.match(component, /spiderMarker\.on\("click", \(\) => \{[\s\S]*if \(performance\.now\(\) < selectionReadyAt\) return;[\s\S]*selectPlace\(entry\.id\)/);
  assert.match(component, /L\.polyline\(\[center, spiderPosition\]/);
  assert.match(component, /setAttribute\("aria-label", `\$\{clusterText\}, \$\{cardCopy\.openCluster\}`\)/);
  assert.match(component, /map\.getBoundsZoom\(paddedClusterBounds, false, L\.point\(140, 140\)\)/);
  assert.match(component, /clusterDistance < 80 \|\| map\.getZoom\(\) >= 14 \|\| targetZoom <= map\.getZoom\(\)/);
  assert.doesNotMatch(component, /distanceTo\(clusterBounds\.getSouthWest\(\)\) < 80\) map\.flyTo/);
});

test("mobile map remains full screen", () => {
  assert.match(styles, /\.map-results-experience \{ position: fixed; inset: 0;[^}]*border-radius: 0/);
});
