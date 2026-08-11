import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const search = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");

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
  assert.match(component, /element\?\.setAttribute\("aria-pressed", String\(active\)\)/);
  assert.match(component, /const selectionReadyAt = performance\.now\(\) \+ 300/);
  assert.match(component, /if \(performance\.now\(\) < selectionReadyAt\) return/);
  assert.match(component, /if \(clustered\) \{[\s\S]*marker\.on\("click", \(\) => \{[\s\S]*selectPlace\(cluster\.entries\[0\]\.id\)/);
  assert.doesNotMatch(component, /title: entry\.name|title: clustered \?/);
  assert.match(component, /basemaps\.cartocdn\.com\/rastertiles\/voyager/);
  assert.match(styles, /\.listing-map-shell \.leaflet-tile-pane \{ filter: saturate\(1\.22\) contrast\(1\.04\) brightness\(\.99\); \}/);
});

test("useful numeric labels appear on markers while generic places keep icons", () => {
  assert.match(component, /const useTextLabel = clustered \|\| \/\\d\/\.test\(place\.markerLabel\)/);
});

test("tightly overlapping clusters expand into individually selectable spider markers", () => {
  assert.match(component, /const spiderfyCluster = \(entries: MapPlace\[\], center: import\("leaflet"\)\.LatLng, clearExisting = true\)/);
  assert.match(component, /spiderfyCluster\(cluster\.entries, clusterCenter\)/);
  assert.match(component, /const threshold = zoom < 8 \? 92 : zoom < 10 \? 66 : zoom < 12 \? 44 : 32/);
  assert.doesNotMatch(component, /if \(clustered && zoom >= 9\)/);
  assert.match(component, /const clusterAnchor = cluster\.entries\.reduce/);
  assert.match(component, /const clusterCenter = L\.latLng\(clusterAnchor\.lat, clusterAnchor\.lng\)/);
  assert.match(component, /const goldenAngle = Math\.PI \* \(3 - Math\.sqrt\(5\)\)/);
  assert.match(component, /spiderMarker\.on\("click", \(\) => \{[\s\S]*if \(performance\.now\(\) < selectionReadyAt\) return;[\s\S]*selectPlace\(entry\.id\)/);
  assert.match(component, /L\.polyline\(\[center, spiderPosition\]/);
  assert.match(component, /setAttribute\("aria-label", `\$\{clusterText\}, \$\{cardCopy\.openCluster\}`\)/);
  assert.match(component, /map\.getBoundsZoom\(paddedClusterBounds, false, L\.point\(140, 140\)\)/);
  assert.match(component, /if \(currentZoom >= 13\)/);
  assert.match(component, /clusterDistance < 80 \|\| targetZoom <= currentZoom/);
  assert.match(component, /map\.setView\(clusterCenter, Math\.min\(13, currentZoom \+ 2\)/);
  assert.doesNotMatch(component, /distanceTo\(clusterBounds\.getSouthWest\(\)\) < 80\) map\.flyTo/);
});

test("mobile map remains full screen", () => {
  assert.match(styles, /\.map-results-experience \{ position: fixed; inset: 0;[^}]*border-radius: 0/);
});

test("desktop search combines a synchronized result list, sticky map and quick filters", () => {
  assert.match(search, /className="airbnb-map-split"/);
  assert.match(search, /className="airbnb-map-split__results result-cards"/);
  assert.match(search, /className="airbnb-map-split__map"/);
  assert.match(search, /className="search-quick-filters"/);
  assert.match(search, />טווח מחיר<\/button>/);
  assert.match(search, /changeBinaryFilter\("pool", !pool\)/);
  assert.match(styles, /\.airbnb-map-split \{[^}]*grid-template-columns:/);
  assert.match(styles, /\.airbnb-map-split__map \{[^}]*position: sticky/);
});

test("vacation markers prioritize verified price and map zoom is direct", () => {
  assert.match(component, /typeof listing\.price === "number"/);
  assert.match(component, /listing\.price\.toLocaleString/);
  assert.match(component, /scrollWheelZoom: true/);
  assert.match(component, /wheelPxPerZoomLevel: 80/);
  assert.match(component, /maxBoundsViscosity: 0\.72/);
});
