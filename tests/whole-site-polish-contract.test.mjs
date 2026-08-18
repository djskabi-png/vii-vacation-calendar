import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("large result families use one restrained progressive-results pattern", async () => {
  const [component, search, spa, hourly, providers, trails] = await Promise.all([
    read("app/components/progressive-results.tsx"),
    read("app/search/page.tsx"),
    read("app/components/world-map-results.tsx"),
    read("app/components/hourly-results.tsx"),
    read("app/components/provider-results.tsx"),
    read("app/trails/trails-explorer.tsx"),
  ]);

  assert.match(component, /initialCount = 9/);
  assert.match(component, /Math\.min\(items\.length, current \+ increment\)/);
  for (const source of [search, spa, hourly, providers, trails]) assert.match(source, /<ProgressiveResults/);
});

test("mobile controls keep modern visuals without undersized hit targets", async () => {
  const css = await read("app/globals.css");
  assert.match(css, /\.stay-card__gallery-dots button,[\s\S]*?width: 44px;[\s\S]*?height: 44px;/);
  assert.match(css, /\.home-slider__controls button \{[^}]*min-height: 44px;/);
  assert.match(css, /\.room-card__more \{[^}]*min-height: 44px;/);
  assert.match(css, /\.search-world-tabs__menu-head > button \{ width: 44px; height: 44px; \}/);
  assert.match(css, /\.provider-faq summary \{ min-height: 60px;/);
  assert.match(css, /\.cookie-actions \.text-button \{ min-height: 44px; \}/);
  assert.match(css, /\.review-experience__empty button \{[\s\S]*?min-height: 44px;/);
  assert.match(css, /\.magazine-search input \{ min-height: 44px; \}/);
  assert.match(css, /\.selected-plan-summary button \{ min-height: 44px;/);
  assert.match(css, /\.spa-results__reset \{ min-height: 44px; \}/);
});

test("privacy preferences reopen through the mounted consent control", async () => {
  const [source, pageShell, experienceCss] = await Promise.all([
    read("app/components/cookie-consent.tsx"),
    read("app/components/page-shell.tsx"),
    read("app/app-experience.css"),
  ]);
  assert.match(source, /window\.dispatchEvent\(new Event\(OPEN_EVENT\)\)/);
  assert.match(source, /<a href=\{SETTINGS_HASH\} className="footer-privacy-button" onClick=\{openPreferences\}>/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /cookie-card--settings/);
  assert.match(source, /cookie-card--notice/);
  assert.match(source, /window\.location\.hash === SETTINGS_HASH[\s\S]*?setSettings\(true\);[\s\S]*?setVisible\(true\);/);
  assert.match(source, /function closeSettings\(\)[\s\S]*?setVisible\(false\)[\s\S]*?window\.history\.replaceState/);
  assert.match(pageShell, /<SiteHeader[\s\S]*?<CookieConsent \/>[\s\S]*?\{children\}/);
  assert.match(experienceCss, /\.cookie-card--notice \{[\s\S]*?position: relative;[\s\S]*?inset: auto;/);
});

test("provider topic rail exposes a visible mobile continuation cue", async () => {
  const [component, css] = await Promise.all([
    read("app/components/provider-results.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(component, /provider-categories__scroll-cue/);
  assert.match(css, /\.provider-categories__scroll-cue \{[\s\S]*?display: grid;[\s\S]*?pointer-events: none;/);
});

test("the noindex platform blueprint remains inside its mobile hero", async () => {
  const css = await read("app/platform/platform.module.css");
  assert.match(css, /\.heroGrid \{ min-width: 0; padding-top: 44px; \}/);
  assert.match(css, /\.heroCopy \{ min-width: 0; max-width: 100%; \}/);
  assert.match(css, /\.orbit \{ width: min\(100%, 370px\);/);
});
