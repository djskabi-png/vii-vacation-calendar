import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const results = await readFile(new URL("../app/components/hourly-results.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const landing = await readFile(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8");
const hourlyPage = await readFile(new URL("../app/hourly/page.tsx", import.meta.url), "utf8");

test("hourly results use one compact toolbar with inline map and collapsible filters", () => {
  assert.match(results, /className="hourly-results__actions"/);
  assert.match(results, /aria-controls="hourly-result-filters"/);
  assert.match(results, />סינון\{/);
  assert.match(results, /className={`button map-button mobile-map-fab \$\{mapOpen/);
  assert.match(styles, /\.hourly-results__filters \{ display: none;/);
  assert.match(styles, /\.hourly-results__filters\.open \{ display: grid;/);
  assert.match(results, /`נמצאו \$\{filtered\.length\} מקומות`/);
  assert.match(styles, /\.world-page--hourly \.results-view-toggle button\.active/);
  assert.match(styles, /\.world-page--hourly \.world-hero \.search-box--hourly/);
  assert.doesNotMatch(styles, /\.world-page--hourly \.world-hero \.search-box--hourly \.search-submit/);
});

test("hourly result bands are full width and the live count is the results heading", () => {
  assert.match(styles, /\.world-page--hourly > \.world-breadcrumbs \{[\s\S]*?width: 100%;[\s\S]*?padding-inline: max\(20px, calc\(\(100% - 1180px\) \/ 2\)\)/);
  assert.match(styles, /\.world-page--hourly \.hourly-results__toolbar \{[\s\S]*?background: transparent;/);
  assert.match(landing, /world !== "spa" && world !== "hourly"/);
  assert.match(results, /<h2 aria-live="polite">\{resultLabel\}<\/h2>/);
  assert.match(hourlyPage, /חדרים וסוויטות לפי שעה ב/);
});

test("mobile hourly results remove quick chips and keep cards unchanged", () => {
  assert.match(styles, /\.world-page--hourly \.world-quick-links \{ display: none; \}/);
  assert.match(styles, /\.hourly-results__actions \.results-view-toggle \{ display: none; \}/);
  assert.match(results, /<DiscoveryCard key={item\.id} item={item} \/>/);
  assert.match(results, /map-button mobile-map-fab/);
  assert.doesNotMatch(styles, /\.discovery-card[^\n]*hourly-first-viewport/);
});
