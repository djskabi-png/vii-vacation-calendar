import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/mobile-stability.css", import.meta.url), "utf8");

test("the shared mobile stability layer loads after the base and result styles", () => {
  const globalIndex = layout.indexOf('import "./globals.css"');
  const resultsIndex = layout.indexOf('import "./results-view.css"');
  const mobileIndex = layout.indexOf('import "./mobile-stability.css"');
  assert.ok(globalIndex >= 0 && resultsIndex > globalIndex && mobileIndex > resultsIndex);
});

test("mobile result columns can shrink without clipping cards", () => {
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.results-list,[\s\S]*?min-width:\s*0/);
  assert.match(css, /\.result-cards\.results-view--list \.stay-card\s*\{[\s\S]*?minmax\(0,\s*1fr\)/);
  assert.match(css, /\.event-list\.results-view--list > article\s*\{[\s\S]*?minmax\(0,\s*1fr\)/);
  assert.match(css, /\.discovery-grid\.results-view--list \.discovery-card\s*\{[\s\S]*?minmax\(0,\s*1fr\)/);
});

test("mobile search fields keep their intended flex layout and low-height actions reachable", () => {
  assert.match(css, /button\.search-step\.search-step--dates\s*\{[\s\S]*?display:\s*flex/);
  assert.match(css, /max-height:\s*680px/);
  assert.match(css, /\.search-box-shell\.mobile-expanded \.search-submit\s*\{[\s\S]*?bottom:/);
});

test("mobile floating actions do not stack over result cards", () => {
  assert.match(css, /body:has\(\.mobile-map-fab:not\(\.active\)\) \.smart-concierge\s*\{\s*display:\s*none/);
  assert.match(css, /\.results-page \.results-list\s*\{[\s\S]*?safe-area-inset-bottom/);
});
