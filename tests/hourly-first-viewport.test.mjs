import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const results = await readFile(new URL("../app/components/hourly-results.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("hourly results use one compact toolbar with inline map and collapsible filters", () => {
  assert.match(results, /className="hourly-results__actions"/);
  assert.match(results, /aria-controls="hourly-result-filters"/);
  assert.match(results, />סינון\{/);
  assert.match(results, /className={`button map-button \$\{mapOpen/);
  assert.doesNotMatch(results, /map-button mobile-map-fab/);
  assert.match(styles, /\.hourly-results__filters \{ display: none;/);
  assert.match(styles, /\.hourly-results__filters\.open \{ display: grid;/);
});

test("mobile hourly results remove quick chips and keep cards unchanged", () => {
  assert.match(styles, /\.world-page--hourly \.world-quick-links \{ display: none; \}/);
  assert.match(styles, /\.hourly-results__actions \.results-view-toggle \{ display: none; \}/);
  assert.match(results, /<DiscoveryCard key={item\.id} item={item} \/>/);
  assert.doesNotMatch(styles, /\.discovery-card[^\n]*hourly-first-viewport/);
});
