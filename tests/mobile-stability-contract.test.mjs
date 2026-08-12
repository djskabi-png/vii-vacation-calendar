import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/mobile-stability.css", import.meta.url), "utf8");
const guard = await readFile(new URL("../app/components/responsive-viewport-guard.tsx", import.meta.url), "utf8");
const search = await readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const showcase = await readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");
const mapViewState = await readFile(new URL("../app/components/map-view-state.ts", import.meta.url), "utf8");

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

test("mobile overlays use the content viewport instead of scrollbar-inclusive viewport units", () => {
  assert.match(css, /\.search-box-shell\.mobile-expanded \.search-box,[\s\S]*?width:\s*auto;[\s\S]*?max-width:\s*100%/);
  assert.match(css, /\.calendar-dialog\.mode-home\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%/);
  assert.match(css, /overscroll-behavior-x:\s*none/);
});

test("mobile horizontal collections contain their overflow without disabling sliders", () => {
  assert.match(css, /\.home-slider__track,[\s\S]*?\.home-vacation-strip__track,[\s\S]*?\.home-last-minute__cards,[\s\S]*?contain:\s*inline-size layout paint/);
  assert.match(css, /\.home-slider__track > \*,[\s\S]*?max-inline-size:\s*calc\(100% - 8px\)/);
  assert.doesNotMatch(css, /\.home-slider__track[\s\S]{0,180}overflow-x:\s*hidden/);
});

test("the viewport guard continuously returns only the root viewport to its horizontal origin", () => {
  assert.match(guard, /window\.addEventListener\("scroll", lockHorizontalScroll, \{ passive: true \}\)/);
  assert.match(guard, /if \(!scrollingElement\?\.scrollLeft/);
  assert.match(guard, /window\.addEventListener\("touchend", reset, \{ passive: true \}\)/);
  assert.doesNotMatch(guard, /querySelectorAll<HTMLElement>\("(?!\[data-horizontal-rail\])/);
});

test("restored mobile tabs reset only declared horizontal rails", () => {
  assert.match(guard, /querySelectorAll<HTMLElement>\("\[data-horizontal-rail\]"\)/);
  assert.match(guard, /rail\.scrollLeft = 0/);
  assert.match(showcase, /data-horizontal-rail/);
});

test("desktop resize releases every mobile-only viewport lock", () => {
  assert.match(search, /matchMedia\("\(min-width: 821px\)"\)/);
  assert.match(search, /if \(event\.matches\) closeMobileSearch\(\)/);
  assert.match(mapViewState, /matchMedia\("\(min-width: 821px\)"\)/);
  assert.match(mapViewState, /if \(event\.matches\) unlockPage\(\)/);
  assert.match(guard, /function releaseStaleViewportLocks/);
  assert.match(guard, /body\.hasAttribute\("data-map-overlay-lock"\)/);
  assert.match(guard, /window\.addEventListener\("resize", reset\)/);
  assert.match(guard, /window\.visualViewport\?\.addEventListener\("resize", reset\)/);
});

test("search restores a readable vacation date label from the submitted range", () => {
  assert.match(search, /function dateLabelFromSearch/);
  assert.match(search, /searchParams\.get\("from"\)/);
  assert.match(search, /searchParams\.get\("till"\)/);
  assert.match(search, /activeRouteLanguage\(language\)/);
  assert.match(search, /languageFromPathname\(window\.location\.pathname\)/);
  assert.match(search, /setDates\(dateLabelFromSearch\(searchParams, mode, languageFromPathname\(window\.location\.pathname\)\)\)/);
  assert.match(search, /setLocationValue\(isWholeCountrySelection\(requestedLocation\) \? "כל הארץ"/);
});
