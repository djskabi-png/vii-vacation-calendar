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
  assert.match(component, /marker\.on\("click", \(event\) => \{[\s\S]*selectPlace\(place\.id\)/);
});

test("place cards open only after marker activation and use a quiet modern basemap", () => {
  assert.match(component, /const initialSelectedId = single \?/);
  assert.doesNotMatch(component, /\.on\("mouseover", \(\) => setSelectedId/);
  assert.doesNotMatch(component, /\.on\("focus", \(\) => setSelectedId/);
  assert.match(component, /marker\.on\("click", \(event\) => \{[\s\S]*L\.DomEvent\.stopPropagation/);
  assert.match(component, /element\?\.setAttribute\("aria-pressed", String\(active\)\)/);
  assert.doesNotMatch(component, /selectionReadyAt/);
  assert.match(component, /if \(event\.originalEvent && event\.originalEvent === clusterActivationEvent\) return/);
  assert.doesNotMatch(component, /if \(clustered\) \{[\s\S]*marker\.on\("click", \(\) => \{[\s\S]*selectPlace\(cluster\.entries\[0\]\.id\)/);
  assert.match(component, /marker\.on\("click", \(event\) => \{[\s\S]*clusterActivationEvent = event\.originalEvent;[\s\S]*selectedIdRef\.current = "";[\s\S]*setSelectedId\(""/);
  assert.doesNotMatch(component, /title: entry\.name|title: clustered \?/);
  assert.match(component, /https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.doesNotMatch(component, /cartocdn|carto\.com|subdomains:/);
  assert.match(component, /maxNativeZoom: 19/);
  assert.match(component, /streetTiles\.on\("tileerror"/);
  assert.match(component, /streetFallbackUsed/);
  assert.match(styles, /\.listing-map-shell \.leaflet-tile-pane \{ filter: saturate\(\.76\) contrast\(\.94\) brightness\(1\.06\); \}/);
  assert.match(component, /setAttribute\("aria-label", layerNames\.layers\)/);
});

test("failed street tiles switch the whole layer once without touching markers", () => {
  const body=component.match(/streetTiles\.on\("tileerror", \(\) => \{([\s\S]*?)\n      \}\);/)?.[1];
  assert.ok(body);
  const marker={};const layers=new Set([marker]);const street={};let adds=0,removes=0;
  const map={hasLayer:layer=>layers.has(layer),removeLayer:layer=>{removes++;layers.delete(layer);}};
  const aerial={addTo:()=>{adds++;layers.add(aerial);}};
  const fail=new Function("map","streetTiles","aerialTiles",`let streetFallbackUsed=false;return ()=>{${body}};`)(map,street,aerial);
  fail();assert.equal(adds,0);layers.add(street);fail();fail();assert.equal(adds,1);assert.equal(removes,1);assert.ok(layers.has(marker));assert.ok(layers.has(aerial));assert.ok(!layers.has(street));
  layers.add(street);fail();assert.equal(adds,1);
});

test("marker semantics are explicit so dates and capacities never masquerade as prices", () => {
  assert.match(component, /markerKind: "price" \| "capacity" \| "count" \| "category"/);
  assert.match(component, /const useTextLabel = clustered \|\| place\.markerKind !== "category"/);
  assert.match(component, /marker-kind--\$\{clustered \? "count" : place\.markerKind\}/);
  assert.doesNotMatch(component, /\/\\d\/\.test\(place\.markerLabel\)/);
});

test("tightly overlapping clusters expand into individually selectable spider markers", () => {
  assert.match(component, /const spiderfyCluster = \(entries: MapPlace\[\], center: import\("leaflet"\)\.LatLng, clearExisting = true\)/);
  assert.match(component, /spiderfyCluster\(cluster\.entries, clusterCenter, false\)/);
  assert.match(component, /const threshold = zoom < 8 \? 76 : zoom < 10 \? 52 : zoom < 12 \? 32 : 18/);
  assert.match(component, /let expandedPlaceIds = new Set<string>\(\)/);
  assert.match(component, /const explicitlyExpanded = clustered && cluster\.entries\.every/);
  assert.match(component, /if \(clustered && \(zoom >= 12 \|\| explicitlyExpanded\)\)/);
  assert.match(component, /expandedPlaceIds = new Set\(cluster\.entries\.map\(\(entry\) => entry\.id\)\)/);
  assert.doesNotMatch(component, /if \(clustered && zoom >= 9\)/);
  assert.match(component, /const clusterAnchor = cluster\.entries\.reduce/);
  assert.match(component, /const clusterCenter = L\.latLng\(clusterAnchor\.lat, clusterAnchor\.lng\)/);
  assert.match(component, /const goldenAngle = Math\.PI \* \(3 - Math\.sqrt\(5\)\)/);
  assert.match(component, /spiderMarker\.on\("click", \(event\) => \{[\s\S]*event\.originalEvent === clusterActivationEvent\) return;[\s\S]*selectPlace\(entry\.id\)/);
  assert.match(component, /L\.polyline\(\[center, spiderPosition\]/);
  assert.match(component, /setAttribute\("aria-label", `\$\{clusterText\}, \$\{mapControlCopy\.cluster\}`\)/);
  assert.match(component, /map\.getBoundsZoom\(paddedClusterBounds, false, L\.point\(140, 140\)\)/);
  assert.match(component, /clusterDistance < 120 \|\| targetZoom <= currentZoom/);
  assert.match(component, /map\.setView\(clusterCenter, Math\.min\(12, Math\.max\(10, currentZoom \+ 3\)\)/);
  assert.doesNotMatch(component, /distanceTo\(clusterBounds\.getSouthWest\(\)\) < 80\) map\.flyTo/);
});

test("mobile map remains full screen", () => {
  assert.match(styles, /\.map-results-experience \{ position: fixed; inset: 0;[^}]*border-radius: 0/);
});

test("tablet map keeps a real canvas height instead of collapsing", () => {
  assert.match(styles, /@media \(min-width: 821px\) and \(max-width: 1100px\) \{[\s\S]*\.airbnb-map-split__map,[\s\S]*\.event-map-pane \{[\s\S]*height: clamp\(560px, calc\(100dvh - 24px\), 820px\);[\s\S]*min-height: 560px;/);
});

test("desktop search combines a synchronized result list, sticky map and quick filters", () => {
  assert.match(search, /className="airbnb-map-split"/);
  assert.match(search, /className={`airbnb-map-split__results result-cards results-view results-view--\${viewMode}`}/);
  assert.match(search, /className="airbnb-map-split__map"/);
  assert.match(search, /className="search-quick-filters"/);
  assert.match(search, />טווח מחיר<\/button>/);
  assert.match(search, /changeBinaryFilter\("pool", !pool\)/);
  assert.match(styles, /\.airbnb-map-split \{[^}]*grid-template-columns:/);
  assert.match(styles, /\.airbnb-map-split__map \{[^}]*position: sticky/);
});

test("vacation markers prioritize verified price and map zoom is direct", () => {
  assert.match(component, /priceById\?\.\[listing\.slug\]/);
  assert.match(component, /validMapPrice\(listing\.price\)/);
  assert.match(component, /formatMapPrice\(verifiedPrice, language\)/);
  assert.match(component, /scrollWheelZoom: interactive/);
  assert.match(component, /const \[interactive, setInteractive\] = useState\(autoLoad\)/);
  assert.match(component, /wheelPxPerZoomLevel: 80/);
  assert.match(component, /maxBoundsViscosity: 0\.72/);
  assert.match(component, /minZoom: 7/);
});

test("map controls and Hebrew basemap are localized", () => {
  assert.match(component, /zoomControl: false/);
  assert.match(component, /zoomInTitle: mapControlCopy\.zoomIn/);
  assert.match(component, /zoomOutTitle: mapControlCopy\.zoomOut/);
  assert.match(component, /const streetTileUrl = "https:\/\/tile\.openstreetmap\.org/);
});
