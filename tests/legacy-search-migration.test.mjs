import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sitemapSection } from "../app/lib/sitemap-inventory.ts";
import { publicSearchOpportunityAllowed } from "../app/lib/search-opportunities.ts";

const exported = JSON.parse(readFileSync(new URL("../project_knowledge/launch/legacy-search-pages-complete-merged-20261022.json", import.meta.url), "utf8"));
const publications = JSON.parse(readFileSync(new URL("../app/data/legacy-search-page-publications.json", import.meta.url), "utf8"));
const redirects = JSON.parse(readFileSync(new URL("../app/data/legacy-redirect-inventory.json", import.meta.url), "utf8"));
const opportunitySource = readFileSync(new URL("../app/lib/search-opportunities.ts", import.meta.url), "utf8");

test("every legacy sitemap search page has one unique published replacement", () => {
  assert.ok(exported.legacySearchUrlCount >= 2313);
  assert.equal(exported.rows.length, exported.legacySearchUrlCount);
  assert.equal(publications.count, exported.legacySearchUrlCount - 2);
  assert.equal(publications.aliases.length, 2);
  assert.equal(publications.count + publications.aliases.length, exported.legacySearchUrlCount);
  assert.equal(new Set(publications.pages.map((page) => page.id)).size, publications.count);
  assert.equal(new Set(publications.pages.map((page) => page.canonicalPath)).size, publications.count);
});

test("every migrated search source has a direct 301 target and is no longer gone", () => {
  const gone = new Set(redirects.gone);
  const bySource = new Map(publications.pages.map((page) => [page.legacySourcePath, page]));
  for (const source of exported.rows.map((row) => row.sourcePath)) {
    const page = bySource.get(source);
    if (!page) continue;
    assert.equal(redirects.redirects[source], page.canonicalPath, source);
    assert.equal(gone.has(source), false, source);
  }
  for (const alias of publications.aliases) {
    const target = bySource.get(alias.targetSourcePath)?.canonicalPath;
    assert.ok(target, alias.targetSourcePath);
    assert.equal(redirects.redirects[alias.sourcePath], target, alias.sourcePath);
    assert.equal(gone.has(alias.sourcePath), false, alias.sourcePath);
  }
  assert.equal(redirects.stats.managedSearchRedirects, publications.count + publications.aliases.length);
  assert.deepEqual(redirects.gone.filter((source) => /^\/s(?:\/|\?|$)/.test(source)), []);
  assert.equal(redirects.stats.total, Object.keys(redirects.redirects).length + redirects.gone.length);
  const yavneel = bySource.get("/s/yavneel/13690");
  assert.ok(yavneel, "new live legacy Yavneel search page must be preserved");
  assert.equal(yavneel.canonicalPath, "/search/vacations/yavneel-13690-ca826506");
  assert.equal(redirects.redirects["/s/yavneel/13690"], yavneel.canonicalPath);
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
    assert.ok(page.body.length >= 120 && page.body.length <= 8000, page.legacySourcePath);
    assert.doesNotMatch(page.canonicalPath, /[\u0590-\u05ff]/, page.canonicalPath);
  }
  assert.ok(publications.pages.filter((page) => page.faq.length > 0).length >= 1200);
  for (const target of Object.values(redirects.redirects)) assert.doesNotMatch(target, /[\u0590-\u05ff]/, target);
  assert.equal(redirects.redirects["/%d7%a6%d7%95%d7%a8_%d7%a7%d7%a9%d7%a8"], "/join");
  assert.match(opportunitySource, /status: "published"/);
  assert.match(opportunitySource, /robotsIndex: true/);
  assert.match(opportunitySource, /function legacyBody/);
});

test("only publication-quality migrated pages are included in the managed search sitemap family", async () => {
  const entries = await sitemapSection("search-pages");
  const eligible = publications.pages.filter((page) => publicSearchOpportunityAllowed({ ...page, body: page.body || page.metaDescription }));
  assert.equal(entries.length, eligible.length);
  const urls = new Set(entries.map((entry) => new URL(entry.url).pathname));
  for (const page of eligible) assert.equal(urls.has(page.canonicalPath), true, page.canonicalPath);
});
