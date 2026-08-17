import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const component = readFileSync(new URL("../app/components/world-map-results.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("spa result actions sit in a clean toolbar immediately above the results", () => {
  const filterStrip = component.indexOf('className="spa-results__filter-strip"');
  const resultsHeading = component.indexOf('className="spa-results__heading"');
  const resultCards = component.indexOf("filtered.length > 0 ? mapOpen");

  assert.ok(filterStrip > -1, "spa filter strip is present");
  assert.ok(resultsHeading > filterStrip, "result actions are outside and after the filter strip");
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
  assert.match(styles, /@media \(max-width: 560px\) \{[\s\S]*?\.spa-results__landing-links a \{[^}]*min-height:\s*64px/);
});
