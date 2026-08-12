import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mapSource = readFileSync(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the results map supports natural zoom without jumping on marker selection", () => {
  assert.match(mapSource, /scrollWheelZoom:\s*true/);
  assert.doesNotMatch(mapSource, /addEventListener\("wheel"/);
  assert.doesNotMatch(mapSource, /preventDefault\(\)/);
  assert.doesNotMatch(mapSource, /map\.flyTo\(/);
  assert.match(mapSource, /touchZoom:\s*true/);
  assert.match(mapSource, /doubleClickZoom:\s*true/);
  assert.match(mapSource, /zoomControl:\s*false/);
  assert.match(mapSource, /L\.control\.zoom\(/);
});

test("the desktop search loader stays circular while preserving its spinner", () => {
  assert.match(css, /\.search-submit__icon > i\s*\{[^}]*border-radius:\s*50%/);
  assert.match(css, /@media \(min-width:\s*821px\)\s*\{\s*\.search-submit\.is-searching\s*\{[^}]*min-width:\s*56px;[^}]*width:\s*56px;[^}]*height:\s*56px;[^}]*border-radius:\s*50%/);
  assert.doesNotMatch(css, /\.search-submit\.is-searching\s*\{[^}]*min-width:\s*132px/);
});