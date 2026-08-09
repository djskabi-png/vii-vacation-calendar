import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const taxonomy = readFileSync(new URL("../app/data/spa-landings.ts", import.meta.url), "utf8");
const results = readFileSync(new URL("../app/components/world-map-results.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/spas/[slug]/page.tsx", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");

test("all nine spa feature controls are crawlable clean links", () => {
  assert.equal((taxonomy.match(/slug: "/g) || []).length, 9);
  assert.match(results, /<Link key=\{filter\.id\} href=\{spaLandingHref\(filter\)\}/);
  assert.doesNotMatch(results, /spaFilters\.map\(\(filter\) => <label/);
});

test("spa landing template has unique metadata, breadcrumbs and filtered collection data", () => {
  assert.match(page, /generateMetadata/);
  assert.match(page, /alternates: \{ canonical: path \}/);
  assert.match(page, /breadcrumbSchema/);
  assert.match(page, /collectionSchema/);
  assert.match(page, /spaPlaces\.filter\(\(item\) => spaItemMatches\(item, landing\)\)/);
});

test("all curated spa landing pages are included in the sitemap", () => {
  assert.match(sitemap, /spaLandings\.map\(\(landing\) => item\(spaLandingHref\(landing\)/);
});
