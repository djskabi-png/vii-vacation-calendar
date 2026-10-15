import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("spa mobile uses the premium hero and keeps the functional filter rail compact", async () => {
  const [landing, css] = await Promise.all([
    readFile(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(landing, /searchMode && world !== "spa" && world !== "hourly" && <WorldQuickSearches/);
  assert.match(landing, /className="spa-discovery-hero"/);
  assert.match(landing, /spa-discovery-hero__visual/);
  assert.match(landing, /spa-discovery-hero__search/);
  assert.match(css, /\.spa-discovery-hero \{[^}]*z-index: 1;[^}]*overflow: visible;/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.spa-discovery-hero__visual \{ min-height: 168px; \}/);
  assert.match(css, /\.spa-discovery-hero \+ \.section \{ padding-top: 54px; \}/);
  assert.match(css, /\.spa-results__landing-links a \{ width: 88px; min-height: 72px;/);
  assert.match(css, /\.spa-results__filter-label \{[^}]*white-space: normal;[^}]*-webkit-line-clamp: 2;/);
  assert.match(css, /\.spa-results__filter-toggle \{ min-height: 44px; display: inline-flex;/);
  assert.match(css, /\.spa-results__reset:disabled \{ display: none; \}/);
  assert.match(css, /\.spa-results__landing-links > header small \{ display: block; \}/);
});

test("the shared discovery hero grid is not overridden by obsolete attractions or trails rules", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.attractions-page > \.attractions-hero:not\(\.discovery-world-hero\) > \.shell \{ display: block;/);
  assert.doesNotMatch(css, /\.attractions-page > \.attractions-hero > \.shell \{ display: block;/);
  assert.match(css, /\.discovery-world-hero__layout \{ display:grid;/);
});

test("spa filter button controls the real filter strip", async () => {
  const results = await readFile(new URL("../app/components/world-map-results.tsx", import.meta.url), "utf8");
  assert.match(results, /id="spa-result-filters"[^>]*hidden=\{!filtersOpen\}/);
  assert.match(results, /className="spa-results__filter-toggle"[^>]*aria-controls="spa-result-filters"[^>]*aria-expanded=\{filtersOpen\}/);
  assert.match(results, /aria-busy=\{pending\}/);
  assert.match(results, /spa-results__filter-spinner/);
  assert.match(results, /pending \? "מעדכנים\.\.\." : filter\.label/);
});
