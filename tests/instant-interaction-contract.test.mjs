import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("live discovery families preserve last good content while refreshing", async () => {
  const [vacation, spa, holiday, styles] = await Promise.all([
    readFile(new URL("app/components/home-live-deals.tsx", root), "utf8"),
    readFile(new URL("app/components/spa-package-deals.tsx", root), "utf8"),
    readFile(new URL("app/components/holiday-live-deals.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.doesNotMatch(vacation, /setState\("loading"\);\s*setData\(null\)/);
  assert.match(vacation, /displayState === "loading" && !data/);
  assert.match(vacation, /const refreshing = displayState === "loading" && data !== null/);
  assert.doesNotMatch(spa, /setStatus\("loading"\);\s*setData\(null\)/);
  assert.match(spa, /status==="loading"&&!data/);
  assert.match(holiday, /setResult\(\(current\) => \(\{ \.\.\.current, key, status: "loading" \}\)\)/);
  assert.match(holiday, /setResult\(\(current\) => \(\{ \.\.\.current, key, status: "error" \}\)\)/);
  assert.match(styles, /\.home-live-deals__results\.is-refreshing/);
  assert.match(styles, /pointer-events: none/);
  assert.match(vacation, /inert=\{refreshing \|\| undefined\}/);
  assert.match(spa, /inert=\{refreshing \|\| undefined\}/);
  assert.match(holiday, /inert=\{state === "loading" \|\| undefined\}/);
  assert.match(styles, /prefers-reduced-motion:[^)]+\)[^{]*\{[^}]*\.home-live-deals__results\.is-refreshing::after/s);
});

test("map stabilization avoids full result serialization", async () => {
  const map = await readFile(new URL("app/components/listing-map.tsx", root), "utf8");
  assert.doesNotMatch(map, /JSON\.stringify\(incomingPlaces\)/);
  assert.match(map, /incomingPlaces\.map\(\(place\) => \[/);
  for (const field of ["place.id", "place.name", "place.images", "place.lat", "place.lng", "place.href", "place.markerLabel"]) {
    assert.match(map, new RegExp(field.replace(".", "\\.")));
  }
  assert.match(map, /useMemo\(\(\) => incomingPlaces, \[placesSignature\]\)/);
});

test("shared card images reserve intrinsic dimensions", async () => {
  const [property, preview] = await Promise.all([
    readFile(new URL("app/components/property-card.tsx", root), "utf8"),
    readFile(new URL("app/components/preview-card-gallery.tsx", root), "utf8"),
  ]);
  for (const source of [property, preview]) {
    assert.match(source, /width="900" height="667"/);
    assert.match(source, /decoding="async"/);
  }
});
