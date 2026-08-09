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

test("mobile map remains full screen and hides the desktop result rail", () => {
  assert.match(styles, /\.map-results-experience \{ position: fixed; inset: 0;[^}]*border-radius: 0/);
  assert.match(styles, /\.map-results-rail \{ display: none; \}/);
});
