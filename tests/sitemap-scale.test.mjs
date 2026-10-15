import test from "node:test";
import assert from "node:assert/strict";
import { localizedEntries, sitemapSectionOrder } from "../app/lib/sitemap-inventory.ts";
import { SITEMAP_PAGE_SIZE, renderSitemapIndex, renderUrlSet, sitemapPage, sitemapPageCount } from "../app/lib/sitemap-xml.ts";

test("large inventories are split into deterministic 10,000 URL sitemap pages", () => {
  const entries = Array.from({ length: SITEMAP_PAGE_SIZE + 1 }, (_, index) => ({ url: `https://vii.spaplus.co/test/${index}` }));
  assert.equal(sitemapPageCount(entries.length), 2);
  assert.equal(sitemapPage(entries, 1).length, SITEMAP_PAGE_SIZE);
  assert.deepEqual(sitemapPage(entries, 2), [{ url: `https://vii.spaplus.co/test/${SITEMAP_PAGE_SIZE}` }]);
});

test("every public language edition is a URL with reciprocal hreflang and bounded images", () => {
  const entries = localizedEntries("/spas/tel-aviv", Array.from({ length: 15 }, (_, index) => `/image-${index}.jpg`));
  assert.equal(entries.length, 4);
  assert.deepEqual(entries.map((entry) => entry.url), [
    "https://vii.spaplus.co/spas/tel-aviv",
    "https://vii.spaplus.co/en/spas/tel-aviv",
    "https://vii.spaplus.co/ru/spas/tel-aviv",
    "https://vii.spaplus.co/fr/spas/tel-aviv",
  ]);
  for (const entry of entries) {
    assert.equal(Object.keys(entry.languages).length, 5);
    assert.equal(entry.languages["x-default"], "https://vii.spaplus.co/spas/tel-aviv");
    assert.equal(entry.images.length, 10);
  }
  const xml = renderUrlSet(entries);
  assert.match(xml, /xmlns:xhtml=/);
  assert.match(xml, /xmlns:image=/);
  assert.equal((xml.match(/<url>/g) || []).length, 4);
  assert.equal((xml.match(/hreflang="en"/g) || []).length, 4);
});

test("sitemap index keeps content families independently diagnosable", () => {
  assert.deepEqual(sitemapSectionOrder, ["core", "holidays", "vacations", "events", "spas", "hourly", "discovery", "search-pages"]);
  const xml = renderSitemapIndex(sitemapSectionOrder.map((section) => `https://vii.spaplus.co/sitemaps/${section}/1.xml`));
  assert.match(xml, /<sitemapindex/);
  assert.match(xml, /\/sitemaps\/search-pages\/1\.xml/);
});

test("XML escapes URLs and timestamps instead of emitting malformed documents", () => {
  const xml = renderUrlSet([{ url: "https://vii.spaplus.co/search?a=1&b=2", lastModified: "2026-10-14T10:00:00.000Z" }]);
  assert.match(xml, /a=1&amp;b=2/);
  assert.match(xml, /<lastmod>2026-10-14T10:00:00.000Z<\/lastmod>/);
});
