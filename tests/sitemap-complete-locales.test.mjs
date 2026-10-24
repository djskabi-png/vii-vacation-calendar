import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("indexable holiday pages expand into every supported locale in the sitemap", async () => {
  const source = await readFile(new URL("../app/lib/sitemap-inventory.ts", import.meta.url), "utf8");
  assert.match(source, /filter\(\(world\) => world\.indexable\)[\s\S]*flatMap\(\(world\) => localizedEntries\(holidayWorldPath\(world\.name, world\.id\)\)\)/);
});

test("the public SEO audit descends from the sitemap index into every child URL", async () => {
  const source = await readFile(new URL("../scripts/audit-public-seo.mjs", import.meta.url), "utf8");
  assert.match(source, /const childSitemaps = xmlUrls\(sitemapIndex\)/);
  assert.match(source, /const allUrls = sitemapDocuments\.flatMap\(\(document\) => document\.urls\)/);
  assert.match(source, /duplicateUrls/);
  assert.match(source, /hreflang x-default חסר/);
  assert.match(source, /request_failed:/, "one slow page must be reported without aborting the complete crawl");
  assert.match(source, /sitemapFailures/, "one slow child sitemap must be reported without hiding the rest of the crawl");
});
