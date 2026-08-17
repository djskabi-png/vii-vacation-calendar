import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("spa mobile removes duplicate suggestions and compacts the functional filter rail", async () => {
  const [landing, css] = await Promise.all([
    readFile(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(landing, /searchMode && world !== "spa" && world !== "hourly" && <WorldQuickSearches/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.world-page--spa \.world-page-heading \+ \.section \{ padding-top: 10px; \}/);
  assert.match(css, /\.spa-results__landing-links a \{ width: 88px; min-height: 72px;/);
  assert.match(css, /\.spa-results__filter-label \{[^}]*white-space: normal;[^}]*-webkit-line-clamp: 2;/);
  assert.match(css, /\.spa-results__filter-toggle \{ min-height: 44px; display: inline-flex;/);
  assert.match(css, /\.spa-results__reset:disabled \{ display: none; \}/);
  assert.match(css, /\.spa-results__swipe-hint \{ display: none; \}/);
});

test("spa filter button controls the real filter strip", async () => {
  const results = await readFile(new URL("../app/components/world-map-results.tsx", import.meta.url), "utf8");
  assert.match(results, /id="spa-result-filters"[^>]*hidden=\{!filtersOpen\}/);
  assert.match(results, /className="spa-results__filter-toggle"[^>]*aria-controls="spa-result-filters"[^>]*aria-expanded=\{filtersOpen\}/);
});
