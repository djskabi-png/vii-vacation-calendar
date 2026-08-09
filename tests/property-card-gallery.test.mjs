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
  assert.match(card, /התמונה הקודמת של/);
  assert.match(card, /התמונה הבאה של/);
  assert.match(card, /event\.preventDefault\(\)/);
  assert.match(card, /event\.stopPropagation\(\)/);
});

test("gallery updates accessible image context and supports touch swiping", () => {
  assert.match(card, /תמונה \$\{imageIndex \+ 1\} מתוך \$\{galleryImages\.length\}/);
  assert.match(card, /aria-live="polite"/);
  assert.match(card, /onTouchStart/);
  assert.match(card, /Math\.abs\(distance\) > 45/);
  assert.match(card, /didSwipe\.current = true/);
  assert.match(card, /if \(!didSwipe\.current\) return/);
  assert.match(card, /setTimeout\(\(\) => \{ didSwipe\.current = false/);
});

test("home recommendations and search results both use the shared gallery card", () => {
  assert.match(home, /<PropertyCard property=\{property\}/);
  assert.match(search, /<PropertyCard key=\{property\.slug\} property=\{property\}/);
  assert.match(css, /\.stay-card__gallery-arrow:focus-visible/);
  assert.match(css, /@media \(hover: none\), \(max-width: 820px\)/);
});
