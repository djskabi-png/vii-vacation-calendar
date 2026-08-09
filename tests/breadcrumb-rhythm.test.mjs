import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("world landing breadcrumbs follow the hero and precede page content", () => {
  for (const path of ["app/components/world-landing.tsx", "app/events/page.tsx", "app/attractions/page.tsx", "app/trails/page.tsx"]) {
    const source = read(path);
    const hero = Math.min(...["world-hero", "events-hero", "attractions-hero", "trails-hero"].map((token) => source.indexOf(token)).filter((index) => index >= 0));
    const breadcrumb = source.indexOf("<BreadcrumbTrail className=\"world-breadcrumbs\"");
    assert.ok(hero >= 0 && breadcrumb > hero, `${path} must place breadcrumbs after its hero`);
  }
});

test("result pages keep search, breadcrumbs, then filters and results", () => {
  for (const path of ["app/search/page.tsx", "app/events/search/page.tsx"]) {
    const source = read(path);
    const search = source.indexOf("results-search shell");
    const breadcrumb = source.indexOf("<BreadcrumbTrail", search);
    const layout = source.indexOf("results-layout", breadcrumb);
    assert.ok(search >= 0 && breadcrumb > search && layout > breadcrumb, `${path} has an inconsistent result-page order`);
  }
});

test("world breadcrumb bands use the shared compact spacing token", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.world-breadcrumbs \{[^}]*padding-block: 12px;[^}]*background: #fff;/);
  assert.match(css, /\.world-page > \.world-breadcrumbs \+ \.section \{ padding-top: 20px; \}/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.world-breadcrumbs \{ padding-block: 8px; \}/);
});

test("desktop map controls use the shared branded pill instead of the legacy grey button", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.map-button \{[^}]*min-height: 46px;[^}]*border-radius: 999px;[^}]*background: linear-gradient\(135deg,#087d89,#075f69\);[^}]*color: #fff;/);
  assert.match(css, /\.map-button:focus-visible \{[^}]*outline: 3px solid/);
});

test("spa and hourly results keep their result heading inside the filter toolbar", () => {
  const landing = read("app/components/world-landing.tsx");
  const spa = read("app/components/world-map-results.tsx");
  const hourly = read("app/components/hourly-results.tsx");
  assert.match(landing, /world !== "spa" && world !== "hourly"/);
  assert.match(spa, /<h2 aria-live="polite">\{resultLabel\}<\/h2>/);
  assert.match(hourly, /filtered\.length === 1 \? "מקום אחד נמצא"/);
  assert.match(hourly, /<h2 aria-live="polite">\{resultLabel\}<\/h2>/);
});

test("dynamic spa and hourly result counts are localized in every public language", () => {
  const localeProvider = read("app/i18n/locale-provider.tsx");
  assert.match(localeProvider, /hourlyResultsMatch = value\.match/);
  assert.match(localeProvider, /spaResultsMatch = value\.match/);
  assert.match(localeProvider, /spaMapResultsMatch = value\.match/);
  for (const language of ["en", "fr", "ru"]) assert.match(localeProvider, new RegExp(`language === "${language}"`));
});
