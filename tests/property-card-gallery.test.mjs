import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const card = await readFile(new URL("../app/components/property-card.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const home = await readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");
const search = await readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8");

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

test("feature rows expose bounded controls instead of an invisible overflow", () => {
  assert.match(card, /stay-card__highlights-shell/);
  assert.match(card, /<SliderRailControls[\s\S]*stay-card__highlight-controls/);
  assert.match(css, /\.stay-card__highlight-controls button/);
});
