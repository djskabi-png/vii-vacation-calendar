import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const header = await readFile(new URL("../app/site-header.tsx", import.meta.url), "utf8");
const switcher = await readFile(new URL("../app/components/world-switcher.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("desktop navigation has no duplicate more menu or gift-card text link", () => {
  assert.doesNotMatch(header, /primaryNavigation/);
  assert.doesNotMatch(header, /className="desktop-nav"/);
  assert.doesNotMatch(header, /className={`header-more/);
  assert.doesNotMatch(header, /<span>עוד<\/span>/);
  assert.match(header, /className={`icon-button header-gift/);
  assert.match(header, /aria-label=\{translate\("גיפט קארד"\)\}/);
  assert.match(css, /\.site-header__inner \{ min-height: 74px; display: grid; grid-template-columns: minmax\(0,1fr\) max-content;/);
});

test("world selection uses a descriptive icon and accessible label", () => {
  assert.match(switcher, /function WorldsIcon/);
  assert.match(switcher, /className="worlds-icon"/);
  assert.match(switcher, /aria-label=\{open \? "סגירת בחירת עולם" : "בחירת עולם"\}/);
  assert.doesNotMatch(switcher, /current\.shortLabel/);
});

test("header utility actions share sizing and world selection is not fixed", () => {
  assert.match(css, /\.icon-button \{ width: 44px; \}/);
  assert.match(css, /\.header-actions \.world-dock \{\s*position: relative;\s*inset: auto;/);
  assert.match(css, /width: 40px;\s*min-width: 40px;\s*min-height: 40px;/);
  assert.match(css, /\.world-dock > button \.worlds-icon \{ width: 20px; height: 20px;/);
});
