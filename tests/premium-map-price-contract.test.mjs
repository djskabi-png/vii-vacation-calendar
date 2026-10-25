import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const map = readFileSync(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8");
const vacation = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const events = readFileSync(new URL("../app/events/search/page.tsx", import.meta.url), "utf8");
const price = readFileSync(new URL("../app/lib/map-price.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const analytics = readFileSync(new URL("../app/lib/analytics.ts", import.meta.url), "utf8");
const qa = readFileSync(new URL("../scripts/audit-map-experience.cjs", import.meta.url), "utf8");

test("all supported discovery worlds share the same map and explicit price parser", () => {
  assert.match(map, /tone: "spa" \| "hourly" \| "activities"/);
  assert.match(map, /verifiedPriceFromLabel\(item\.priceLabel\)/);
  assert.match(price, /explicit currency token/);
  assert.match(price, /\(\?:₪\|ש\["״'\]\?ח\|ILS\)/);
});

test("vacation and event maps receive the same verified prices shown by result cards", () => {
  assert.match(vacation, /const mapPriceById = Object\.fromEntries/);
  assert.match(vacation, /availability\?\.availability !== "available"/);
  assert.match(vacation, /supplierStartingPrice\(startingPrices\[property\.slug\] \?\? property\)/);
  assert.match(vacation, /priceById=\{mapPriceById\}/);
  assert.match(events, /const mapPriceById = Object\.fromEntries/);
  assert.match(events, /result\?\.available === true/);
  assert.match(events, /priceById=\{mapPriceById\}/);
});

test("price markers and selected cards expose decision value without inventing it", () => {
  assert.match(map, /markerKind: compactPrice \? "price"/);
  assert.match(map, /selected\.valueLabel/);
  assert.match(map, /selected\.rating\.toFixed\(1\)/);
  assert.match(css, /\.vii-map-marker-wrap\.marker-kind--price/);
  assert.match(css, /\.map-selection-card__decision/);
  assert.match(css, /\.map-results-summary/);
  assert.match(map, /data-priced-count=\{pricedPlaceCount\}/);
});

test("map interactions are observable without collecting coordinates or typed location", () => {
  assert.match(analytics, /vii_map_interaction/);
  assert.match(analytics, /"open" \| "close" \| "marker_select" \| "search_area"/);
  assert.doesNotMatch(analytics, /map_lat|map_lng|typed_location/);
  assert.match(map, /trackMapInteraction\(\{ action: "marker_select"/);
});

test("map QA covers low height, rotation, viewport refresh and price evidence", () => {
  assert.match(qa, /\["low-height", \{ width: 390, height: 620 \}\]/);
  assert.match(qa, /setViewportSize\(\{ width: 844, height: 390 \}\)/);
  assert.match(qa, /searchAreaAfterViewportChange/);
  assert.match(qa, /pricedPlaceCount/);
});
