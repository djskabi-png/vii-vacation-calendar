import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const header = await readFile(new URL("../app/site-header.tsx", import.meta.url), "utf8");
const switcher = await readFile(new URL("../app/components/world-switcher.tsx", import.meta.url), "utf8");
const pageShell = await readFile(new URL("../app/components/page-shell.tsx", import.meta.url), "utf8");
const accountPage = await readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8");
const joinPage = await readFile(new URL("../app/join/page.tsx", import.meta.url), "utf8");
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

test("global search and world selection use one magnifying-glass trigger with an accessible label", () => {
  assert.match(switcher, /function WorldSearchIcon/);
  assert.match(switcher, /className="world-search-icon"/);
  assert.match(switcher, /<circle cx="11" cy="11" r="7" \/>/);
  assert.match(switcher, /aria-label=\{translate\(open \? "סגירת חיפוש ובחירת עולם" : "חיפוש ובחירת עולם"\)\}/);
  assert.match(switcher, /localizedPath\("\/search", language\)/);
  assert.match(switcher, /חיפוש כללי/);
  assert.doesNotMatch(switcher, /current\.shortLabel/);
});

test("the combined trigger handles touch, pointer and keyboard activation without a double toggle", () => {
  assert.match(switcher, /pointerStartRef/);
  assert.match(switcher, /ignoreClickUntilRef/);
  assert.match(switcher, /onPointerDown=\{rememberPointerStart\}/);
  assert.match(switcher, /onPointerUp=\{finishPointerActivation\}/);
  assert.match(switcher, /onPointerCancel=\{cancelPointerActivation\}/);
  assert.match(switcher, /onClick=\{finishClickActivation\}/);
  assert.match(switcher, /event\.detail > 0/);
  assert.match(switcher, /Math\.hypot/);
});

test("header utility actions share sizing and world selection is not fixed", () => {
  assert.match(css, /\.icon-button \{ width: 44px; \}/);
  assert.match(css, /\.header-actions \.world-dock \{ position: relative; inset: auto; z-index: auto; flex: 0 0 44px; \}/);
  assert.match(css, /\.world-dock > button \{\s*width: 44px;\s*min-width: 44px;\s*min-height: 44px;/);
  assert.match(css, /\.header-actions \.world-dock \{\s*position: relative;\s*inset: auto !important;/);
  assert.doesNotMatch(css, /\.world-dock > button \{\s*width: 40px;\s*min-width: 40px;\s*min-height: 40px;/);
  assert.match(css, /\.world-dock > button \.world-search-icon \{ width: 20px; height: 20px;/);
});

test("the header has one combined search and worlds action plus direct accessibility", () => {
  const worldSwitcherComponent = switcher.match(/export function WorldSwitcher[\s\S]*?(?=function WorldSearchIcon)/)?.[0] ?? "";
  assert.doesNotMatch(header, /header-search/);
  assert.match(header, /<AccessibilityWidget placement="icon" \/>/);
  assert.match(header, /<WorldSwitcher active=\{variant\} \/>/);
  assert.match(worldSwitcherComponent, /localizedPath\("\/search", language\)/);
  assert.match(worldSwitcherComponent, /document\.addEventListener\("click", closeOnOutsideClick\)/);
  assert.doesNotMatch(worldSwitcherComponent, /document\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(switcher, /world-dock__backdrop/);
  assert.match(css, /\.header-actions \.world-dock \{[\s\S]*?inset: auto !important;[\s\S]*?display: block !important;/);
});

test("the combined search and worlds action cannot be disabled by a page", () => {
  assert.doesNotMatch(header, /showWorldSwitcher/);
  assert.doesNotMatch(pageShell, /showWorldSwitcher/);
  assert.doesNotMatch(accountPage, /showWorldSwitcher/);
  assert.doesNotMatch(joinPage, /showWorldSwitcher/);
  assert.match(header, /<WorldSwitcher active=\{variant\} \/>/);
  assert.match(pageShell, /<SiteHeader variant=\{variant\} \/>/);
});

test("an open mobile menu releases its lock when the viewport becomes desktop", () => {
  assert.match(header, /const handleViewportChange = \(\) =>/);
  assert.match(header, /const desktopViewport = window\.matchMedia\("\(min-width: 821px\)"\)/);
  assert.match(header, /desktopViewport\.matches/);
  assert.match(header, /window\.addEventListener\("resize", handleViewportChange\)/);
  assert.match(header, /window\.addEventListener\("orientationchange", handleViewportChange\)/);
  assert.match(header, /desktopViewport\.addEventListener\("change", handleViewportChange\)/);
  assert.match(header, /window\.removeEventListener\("resize", handleViewportChange\)/);
  assert.match(header, /window\.removeEventListener\("orientationchange", handleViewportChange\)/);
  assert.match(header, /desktopViewport\.removeEventListener\("change", handleViewportChange\)/);
});
