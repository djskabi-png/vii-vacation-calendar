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
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.world-breadcrumbs \{ padding-block: 8px; \}/);
});
