import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { publicStyleBundleSources } from "../build/public-style-bundles.mjs";

const component = readFileSync(new URL("../app/components/world-map-results.tsx", import.meta.url), "utf8");
const styles = readEffectiveWorldCss();

test("spa result actions lead the collapsed advanced bank and results", () => {
  const filterStrip = component.indexOf('className="spa-results__filter-strip"');
  const resultsHeading = component.indexOf('className="spa-results__heading"');
  const resultCards = component.indexOf("resultItems.length > 0 ? mapOpen");

  assert.ok(filterStrip > -1, "spa filter strip is present");
  assert.ok(resultsHeading > -1 && resultsHeading < filterStrip, "result actions lead the advanced filter strip");
  assert.ok(resultCards > resultsHeading, "result actions remain directly above the result cards");
  assert.doesNotMatch(component, /spa-results__toolbar/);
  assert.match(component, /spa-results__view-actions[\s\S]*ResultsViewToggle[\s\S]*mobile-map-fab/);
});

test("spa filters use a compact unboxed strip on desktop and mobile", () => {
  assert.match(styles, /\.spa-results__filter-strip \{[^}]*border-block:[^}]*background:\s*transparent/);
  assert.match(styles, /\.spa-results__filters \{[^}]*grid-template-columns:\s*minmax\(0,1fr\) auto/);
  assert.match(styles, /\.spa-results__landing-links a \{[^}]*min-height:\s*82px/);
  assert.doesNotMatch(styles, /\.spa-results__toolbar \{[^}]*border-radius:\s*28px/);
  assert.match(styles, /@media \(max-width: 560px\) \{[\s\S]*?\.spa-results__location-card \{[^}]*min-height:\s*62px/);
  assert.match(styles, /@media \(max-width: 560px\) \{[\s\S]*?\.spa-results__landing-links a \{[^}]*min-height:\s*72px/);
});

test("public SPA bundles retain the branded desktop filter trigger", () => {
  const bundles = publicStyleBundleSources();
  for (const world of ["all", "spa"]) {
    const css = bundles[world];
    assert.match(css, /\.spa-results__filter-toggle\s*\{[^}]*display\s*:\s*inline-flex/);
    assert.match(css, /\.spa-results__filter-toggle\s*\{[^}]*border\s*:\s*1px solid #cce1e7/);
    assert.match(css, /\.spa-results__filter-toggle\s*\{[^}]*border-radius\s*:\s*999px/);
    assert.match(css, /\.spa-results__filter-toggle\s*\{[^}]*background\s*:\s*#fff/);
    assert.match(css, /\.spa-results__filter-toggle\s*\{[^}]*font-family\s*:\s*inherit/);
  }
  for (const world of ["vacations", "events", "hourly"]) assert.doesNotMatch(bundles[world], /\.spa-results__filter-toggle\s*\{[^}]*border-radius\s*:\s*999px/);
});
