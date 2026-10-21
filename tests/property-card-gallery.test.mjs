import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const card = await readFile(new URL("../app/components/property-card.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const home = await readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");
const search = await readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const horizontalRail = await readFile(new URL("../app/components/horizontal-chip-rail.tsx", import.meta.url), "utf8");
const viewportGuard = await readFile(new URL("../app/components/responsive-viewport-guard.tsx", import.meta.url), "utf8");

test("shared vacation card browses verified property gallery images before navigation", () => {
  assert.match(card, /\[property\.image, \.\.\.property\.images\]/);
  assert.match(card, /setImageIndex/);
  assert.match(card, /interfaceCopy\.previous/);
  assert.match(card, /interfaceCopy\.next/);
  assert.match(card, /event\.preventDefault\(\)/);
  assert.match(card, /event\.stopPropagation\(\)/);
});

test("gallery updates accessible image context and supports touch swiping", () => {
  assert.match(card, /\$\{interfaceCopy\.image\} \$\{imageIndex \+ 1\}\/\$\{galleryImages\.length\}/);
  assert.match(card, /aria-live="polite"/);
  assert.match(card, /onTouchStart/);
  assert.match(card, /Math\.abs\(distance\) > 45/);
  assert.match(card, /didSwipe\.current = true/);
  assert.match(card, /if \(!didSwipe\.current\) return/);
  assert.match(card, /setTimeout\(\(\) => \{ didSwipe\.current = false/);
});

test("live home deals and search results share the same complete card interactions", async () => {
  const liveHome = await readFile(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
  assert.match(home, /<HomeLiveDeals \/>/);
  assert.match(liveHome, /home-live-deals__item/);
  assert.match(liveHome, /<PropertyCard/);
  assert.match(search, /<PropertyCard key=\{property\.slug\} property=\{property\}/);
  assert.match(css, /\.stay-card__gallery-arrow:focus-visible/);
  assert.match(css, /@media \(hover: none\), \(max-width: 820px\)/);
});

test("feature rows scroll naturally without arrows and stay above the card link", () => {
  assert.match(card, /stay-card__highlights-shell/);
  assert.doesNotMatch(card, /SliderRailControls|highlightRailRef|stay-card__highlight-controls/);
  assert.match(card, /<HorizontalChipRail className="feature-chips stay-card__highlights" labels=\{cardHighlights\} ariaLabel=\{interfaceCopy.highlights\} \/>/);
  assert.match(css, /\.stay-card__highlights \{[^}]*position: relative;[^}]*z-index: 4;[^}]*overflow-x: auto;/);
  assert.match(css, /\.stay-card__highlights:focus-visible/);
  assert.match(css, /\.stay-card__highlights \{[^}]*scrollbar-width: none;/);
  assert.match(css, /\.stay-card \.stay-card__highlights::-webkit-scrollbar \{ display: none; \}/);
  assert.match(css, /\.stay-card__highlights span \{[^}]*max-width: none;[^}]*text-overflow: clip;/);
  assert.doesNotMatch(css, /\.stay-card__highlight-controls/);
});

test("feature rows support mouse drag, native touch swipe and keyboard scrolling without card navigation", () => {
  assert.match(horizontalRail, /event\.pointerType === "mouse" \|\| event\.pointerType === "pen"/);
  assert.match(horizontalRail, /event\.currentTarget\.scrollLeft = drag\.startScrollLeft - distance/);
  assert.match(horizontalRail, /onPointerCancel=\{finishDrag\}/);
  assert.match(horizontalRail, /onClickCapture=\{suppressDraggedClick\}/);
  assert.match(horizontalRail, /event\.stopPropagation\(\)/);
  assert.match(horizontalRail, /event\.currentTarget\.scrollBy/);
  assert.match(css, /\.horizontal-chip-rail \{[^}]*overflow-x: auto;[^}]*-webkit-overflow-scrolling: touch;[^}]*touch-action: pan-x pan-y;/);
  assert.match(viewportGuard, /window\.addEventListener\("touchend", reset, \{ passive: true \}\)/);
  assert.doesNotMatch(viewportGuard, /const reset = \(\) => \{[^}]*resetHorizontalCollections\(\)/);
});
