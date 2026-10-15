import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("shared maps expose reciprocal active-place state", () => {
  const map = read("app/components/listing-map.tsx");
  const deferred = read("app/components/deferred-listing-map.tsx");

  assert.match(map, /onActivePlaceChange\?: \(id: string \| null\) => void/);
  assert.match(map, /marker\.on\("mouseover", \(\) => activePlaceCallback\.current\?\.\(id\)\)/);
  assert.match(map, /marker\.on\("mouseout", \(\) => activePlaceCallback\.current\?\.\(null\)\)/);
  assert.match(map, /data-map-place-id/);
  assert.match(map, /sharedMarkerCount <= 1/);
  assert.match(map, /is-card-active is-hover-preview/);
  assert.match(map, /L\.marker\(\[place\.lat, place\.lng\]/);
  assert.match(map, /activePlaceId=\{activePlaceId\} onActivePlaceChange=\{onActivePlaceChange\}/);
  assert.match(deferred, /activePlaceId\?: string \| null/);
  assert.match(deferred, /onActivePlaceChange\?: \(id: string \| null\) => void/);
});

test("every commercial map world connects cards and markers", () => {
  const search = read("app/search/page.tsx");
  const eventSearch = read("app/events/search/page.tsx");
  const worldResults = read("app/components/world-map-results.tsx");
  const attractions = read("app/attractions/attractions-explorer.tsx");
  const propertyCard = read("app/components/property-card.tsx");
  const discoveryCard = read("app/components/discovery-card.tsx");

  for (const source of [search, eventSearch, worldResults, attractions]) {
    assert.match(source, /activePlaceId=\{/);
    assert.match(source, /onActivePlaceChange=\{setActiveMap/);
  }
  assert.match(propertyCard, /mapActive \? " is-map-active"/);
  assert.match(propertyCard, /data-map-place-id=\{property\.slug\}/);
  assert.match(discoveryCard, /mapActive \? " is-map-active"/);
  assert.match(discoveryCard, /data-map-place-id=\{item\.id\}/);
});

test("active map association is visually unmistakable and motion-safe", () => {
  const styles = read("app/globals.css");

  assert.match(styles, /\.vii-map-marker-wrap:not\(\.is-cluster\)\.is-card-active \.vii-map-marker \{/);
  assert.match(styles, /transform: translateY\(-8px\) scale\(1\.12\)/);
  assert.match(styles, /0 0 0 13px rgba\(17, 151, 166, \.2\)/);
  assert.match(styles, /\[data-map-place-id\]\.is-map-active/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
