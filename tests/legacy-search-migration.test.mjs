import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sitemapSection } from "../app/lib/sitemap-inventory.ts";
import { publicSearchOpportunityAllowed } from "../app/lib/search-opportunities.ts";

const exported = JSON.parse(readFileSync(new URL("../project_knowledge/launch/legacy-search-pages-20261015.json", import.meta.url), "utf8"));
const publications = JSON.parse(readFileSync(new URL("../app/data/legacy-search-page-publications.json", import.meta.url), "utf8"));
const redirects = JSON.parse(readFileSync(new URL("../app/data/legacy-redirect-inventory.json", import.meta.url), "utf8"));
const opportunitySource = readFileSync(new URL("../app/lib/search-opportunities.ts", import.meta.url), "utf8");

test("every legacy sitemap search page has one unique published replacement", () => {
  assert.equal(exported.legacySearchUrlCount, 2313);
  assert.equal(exported.rows.length, exported.legacySearchUrlCount);
  assert.equal(publications.count, exported.legacySearchUrlCount);
  assert.equal(new Set(publications.pages.map((page) => page.id)).size, publications.count);
  assert.equal(new Set(publications.pages.map((page) => page.canonicalPath)).size, publications.count);
});

test("every migrated search source has a direct 301 target and is no longer gone", () => {
  const gone = new Set(redirects.gone);
  const bySource = new Map(publications.pages.map((page) => [page.legacySourcePath, page]));
  for (const source of exported.rows.map((row) => row.sourcePath)) {
    const page = bySource.get(source);
    assert.ok(page, `missing publication for ${source}`);
    assert.equal(redirects.redirects[source], page.canonicalPath, source);
    assert.equal(gone.has(source), false, source);
  }
  assert.equal(redirects.stats.managedSearchRedirects, exported.legacySearchUrlCount);
  assert.equal(redirects.stats.total, Object.keys(redirects.redirects).length + redirects.gone.length);
});

test("migrated pages satisfy publication content and URL requirements", () => {
  for (const page of publications.pages) {
    assert.match(page.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(page.canonicalPath, /^\/search\/vacations\/[a-z0-9-]+$/);
    assert.ok(page.title.length >= 8 && page.title.length <= 90, page.legacySourcePath);
    assert.ok(page.metaTitle.length >= 8 && page.metaTitle.length <= 70, page.legacySourcePath);
    assert.ok(page.metaDescription.length >= 40 && page.metaDescription.length <= 180, page.legacySourcePath);
    assert.ok(page.h1.length >= 8 && page.h1.length <= 100, page.legacySourcePath);
    assert.ok(page.summary.length >= 30 && page.summary.length <= 420, page.legacySourcePath);
  }
  assert.match(opportunitySource, /status: "published"/);
  assert.match(opportunitySource, /robotsIndex: true/);
  assert.match(opportunitySource, /function legacyBody/);
});

test("only publication-quality migrated pages are included in the managed search sitemap family", async () => {
  const entries = await sitemapSection("search-pages");
  const eligible = publications.pages.filter((page) => publicSearchOpportunityAllowed({ ...page, body: publications.bodyTemplate.join("\n\n") }));
  assert.equal(entries.length, eligible.length);
  const urls = new Set(entries.map((entry) => new URL(entry.url).pathname));
  for (const page of eligible) assert.equal(urls.has(page.canonicalPath), true, page.canonicalPath);
});
