import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const header = await readFile(new URL("../app/site-header.tsx", import.meta.url), "utf8");
const switcher = await readFile(new URL("../app/components/world-switcher.tsx", import.meta.url), "utf8");
const pageShell = await readFile(new URL("../app/components/page-shell.tsx", import.meta.url), "utf8");
const accountPage = await readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8");
const joinPage = await readFile(new URL("../app/join/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const polishCss = await readFile(new URL("../app/site-polish.css", import.meta.url), "utf8");

test("footer links stay unadorned without disabling the accessibility underline option", () => {
  assert.match(css, /\.site-footer a, \.site-footer \.footer-privacy-button \{ text-decoration: none; \}/);
  assert.doesNotMatch(polishCss, /\.footer-grid nav a|\.footer-bottom a/);
  assert.match(css, /\.a11y-underline-links a \{ text-decoration: underline !important;/);
});

test("desktop navigation has no duplicate more menu or gift-card text link", () => {
  assert.doesNotMatch(header, /primaryNavigation/);
  assert.doesNotMatch(header, /className="desktop-nav"/);
  assert.doesNotMatch(header, /className={`header-more/);
  assert.doesNotMatch(header, /<span>עוד<\/span>/);
  assert.match(header, /className={`icon-button header-gift/);
  assert.match(header, /aria-label=\{translate\("גיפט קארד"\)\}/);
  assert.match(css, /\.site-header__inner \{ min-height: 74px; display: grid; grid-template-columns: minmax\(0,1fr\) max-content;/);
});

test("world selection uses one immediately interactive current-topic and chevron trigger", () => {
  assert.match(switcher, /function WorldToggleIcon/);
  assert.match(switcher, /className="world-toggle-icon"/);
  assert.match(switcher, /headerWorldLabel\(active, language\)/);
  assert.match(switcher, /<details ref=\{rootRef\} className="world-dock" suppressHydrationWarning>/);
  assert.match(switcher, /<summary ref=\{triggerRef\}>/);
  assert.doesNotMatch(switcher, /localizedPath\("\/search", language\)/);
  assert.doesNotMatch(switcher, /חיפוש כללי|חפשו מקום, עסק או יעד בכל האתר/);
  assert.doesNotMatch(switcher, /current\.shortLabel/);
});

test("the chooser works natively before hydration and closes accessibly after hydration", () => {
  assert.match(switcher, /useRef<HTMLDetailsElement>/);
  assert.match(switcher, /rootRef\.current\.open = false/);
  assert.match(switcher, /triggerRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(switcher, /pointerStartRef|ignoreClickUntilRef|useSyncExternalStore/);
});

test("the server-rendered chooser never falls back to vacation search", () => {
  assert.match(switcher, /<nav className="world-dock__panel"/);
  assert.doesNotMatch(switcher, /world-dock__prehydrate|globalSearchHref/);
  assert.doesNotMatch(polishCss, /world-dock__prehydrate/);
});

test("world links navigate on pointer activation without a full document reload or duplicate click", () => {
  assert.match(switcher, /const navigateFromSwitcher = \(event: ReactMouseEvent<HTMLAnchorElement>\)/);
  assert.match(switcher, /event\.preventDefault\(\)/);
  assert.match(switcher, /event\.currentTarget\.getAttribute\("href"\)/);
  assert.match(switcher, /lastNavigationRef\.current = \{ href, until: performance\.now\(\) \+ 650 \}/);
  assert.match(switcher, /router\.push\(href\)/);
  assert.doesNotMatch(switcher, /window\.location\.assign\(href\)/);
  assert.doesNotMatch(switcher, /navigationCloseTimerRef/);
  assert.match(switcher, /const navigateFromSwitcherPointer = \(event: ReactPointerEvent<HTMLAnchorElement>\)/);
  assert.match(switcher, /onPointerDown=\{navigateFromSwitcherPointer\}/);
  assert.match(switcher, /onClick=\{navigateFromSwitcher\}/);
  assert.doesNotMatch(switcher, /onClick=\{\(\) => setOpen\(false\)\}/);
});

test("header utility actions share sizing and world selection is not fixed", () => {
  assert.match(css, /\.icon-button \{ width: 44px; \}/);
  assert.match(css, /\.header-actions \.world-dock \{ position: relative; inset: auto; z-index: auto; flex: 0 1 auto; \}/);
  assert.match(css, /\.world-dock > summary \{\s*width: 76px;\s*min-width: 68px;\s*max-width: 76px;\s*min-height: 44px;/);
  assert.match(css, /\.header-actions \.world-dock \{\s*position: relative;\s*inset: auto !important;/);
  assert.doesNotMatch(css, /\.world-dock > summary \{\s*width: 40px;\s*min-width: 40px;\s*min-height: 40px;/);
  assert.match(css, /\.world-dock > summary \.world-toggle-icon \{ width: 16px; height: 16px;/);
});

test("the header has one combined search and worlds action plus direct accessibility", () => {
  const worldSwitcherComponent = switcher.match(/export function WorldSwitcher[\s\S]*?(?=function WorldToggleIcon)/)?.[0] ?? "";
  assert.doesNotMatch(header, /header-search/);
  assert.match(header, /<AccessibilityWidget placement="icon" \/>/);
  assert.match(header, /<WorldSwitcher active=\{activeWorld\} \/>/);
  assert.match(worldSwitcherComponent, /document\.addEventListener\("click", closeOnOutsideClick\)/);
  assert.doesNotMatch(worldSwitcherComponent, /document\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(switcher, /world-dock__backdrop/);
  assert.match(css, /\.header-actions \.world-dock \{[\s\S]*?inset: auto !important;[\s\S]*?display: block !important;/);
  assert.match(header, /pathname === "\/trails"[\s\S]*\? "trails"[\s\S]*pathname === "\/attractions"[\s\S]*\? "attractions"/);
  assert.match(header, /<WorldSwitcher active=\{activeWorld\} \/>/);
});

test("the combined search and worlds action cannot be disabled by a page", () => {
  assert.doesNotMatch(header, /showWorldSwitcher/);
  assert.doesNotMatch(pageShell, /showWorldSwitcher/);
  assert.doesNotMatch(accountPage, /showWorldSwitcher/);
  assert.doesNotMatch(joinPage, /showWorldSwitcher/);
  assert.match(header, /<WorldSwitcher active=\{activeWorld\} \/>/);
  assert.match(pageShell, /<SiteHeader variant=\{variant\} \/>/);
});

test("an open mobile menu releases its lock when the viewport becomes desktop", () => {
  assert.match(header, /const handleViewportChange = \(\) =>/);
  assert.match(header, /const desktopViewport = window\.matchMedia\("\(min-width: 821px\)"\)/);
  assert.match(header, /const openedFromMobile = !desktopViewport\.matches/);
  assert.match(header, /desktopViewport\.matches/);
  assert.match(header, /openedFromMobile \? window\.setInterval\(handleViewportChange, 120\) : undefined/);
  assert.match(header, /window\.addEventListener\("resize", handleViewportChange\)/);
  assert.match(header, /window\.addEventListener\("orientationchange", handleViewportChange\)/);
  assert.match(header, /desktopViewport\.addEventListener\("change", handleViewportChange\)/);
  assert.match(header, /window\.removeEventListener\("resize", handleViewportChange\)/);
  assert.match(header, /window\.removeEventListener\("orientationchange", handleViewportChange\)/);
  assert.match(header, /desktopViewport\.removeEventListener\("change", handleViewportChange\)/);
  assert.match(header, /window\.clearInterval\(viewportFallback\)/);
});
