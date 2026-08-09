import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("desktop map combines a synchronized result rail and map canvas", () => {
  assert.match(component, /<aside className="map-results-rail"/);
  assert.match(component, /className={`map-result-card \$\{place\.id === effectiveSelectedId \? "is-selected"/);
  assert.match(component, /onClick=\{\(\) => selectPlace\(place\.id\)\}/);
  assert.match(component, /data-map-result-id=\{place\.id\}/);
  assert.match(component, /scrollIntoView\(\{ block: "nearest", behavior: "smooth" \}\)/);
  assert.match(styles, /\.map-results-experience \{[^}]*display: grid;[^}]*grid-template-areas: "rail map"/);
});

test("useful numeric labels appear on markers while generic places keep icons", () => {
  assert.match(component, /const useTextLabel = clustered \|\| \/\\d\/\.test\(place\.markerLabel\)/);
});

test("tightly overlapping clusters expand into individually selectable spider markers", () => {
  assert.match(component, /const spiderfyCluster = \(entries: MapPlace\[\], center:/);
  assert.match(component, /spiderfyCluster\(cluster\.entries, clusterCenter\)/);
  assert.match(component, /spiderMarker\.on\("click", \(\) => selectPlace\(entry\.id\)\)/);
  assert.match(component, /L\.polyline\(\[center, spiderPosition\]/);
  assert.match(component, /setAttribute\("aria-label", `\$\{clusterText\}, \$\{cardCopy\.openCluster\}`\)/);
  assert.match(component, /map\.getBoundsZoom\(paddedClusterBounds, false, L\.point\(140, 140\)\)/);
  assert.match(component, /clusterDistance < 80 \|\| map\.getZoom\(\) >= 14 \|\| targetZoom <= map\.getZoom\(\)/);
  assert.doesNotMatch(component, /distanceTo\(clusterBounds\.getSouthWest\(\)\) < 80\) map\.flyTo/);
});

test("mobile map remains full screen and hides the desktop result rail", () => {
  assert.match(styles, /\.map-results-experience \{ position: fixed; inset: 0;[^}]*border-radius: 0/);
  assert.match(styles, /\.map-results-rail \{ display: none; \}/);
});
