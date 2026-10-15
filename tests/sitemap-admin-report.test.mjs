import test from "node:test";
import assert from "node:assert/strict";
import { buildSitemapAdminReport, GOOGLE_SITEMAP_MAX_BYTES, GOOGLE_SITEMAP_MAX_URLS, sitemapEntryKind } from "../app/lib/sitemap-report.ts";

test("admin report reconciles every sitemap family and file against Google limits", () => {
  const entry = (path) => ({ url: `https://vii.spaplus.co${path}`, languages: { "he-IL": `https://vii.spaplus.co${path}`, en: `https://vii.spaplus.co/en${path}` }, images: ["https://vii.spaplus.co/image.jpg"] });
  const report = buildSitemapAdminReport({
    core: [entry("/")],
    holidays: [entry("/holidays/hanukkah")],
    vacations: [entry("/search"), entry("/business?id=vacation-1")],
    events: [entry("/events"), entry("/events/place/event-1")],
    spas: [entry("/spas"), entry("/discover/place/spa-1")],
    hourly: [entry("/hourly"), entry("/discover/place/hourly-1")],
    discovery: [entry("/guides"), entry("/guides/article-1")],
    "search-pages": [entry("/search-pages/north")],
  });
  assert.equal(report.sections.length, 8);
  assert.equal(report.totalFiles, report.sections.reduce((sum, section) => sum + section.fileDetails.length, 0));
  assert.equal(report.totalUrls, report.sections.reduce((sum, section) => sum + section.urls, 0));
  assert.equal(report.healthy, true);
  for (const section of report.sections) {
    for (const file of section.fileDetails) {
      assert.ok(file.urls > 0 && file.urls <= GOOGLE_SITEMAP_MAX_URLS);
      assert.ok(file.bytes > 0 && file.bytes <= GOOGLE_SITEMAP_MAX_BYTES);
      assert.ok(file.contents.length > 0);
      assert.ok(file.languages.length > 0);
      assert.ok(file.samples.length > 0 && file.samples.length <= 4);
      assert.match(file.url, new RegExp(`^/sitemaps/${section.section}/\\d+\\.xml$`));
    }
  }
});

test("vacation report explains search, place and landing entries", () => {
  assert.equal(sitemapEntryKind("vacations", { url: "https://vii.spaplus.co/search" }), "vacation-search");
  assert.equal(sitemapEntryKind("vacations", { url: "https://vii.spaplus.co/en/business?id=vacation-1" }), "place-pages");
  assert.equal(sitemapEntryKind("vacations", { url: "https://vii.spaplus.co/fr/villas/north" }), "region-type-landings");
});

test("holiday report identifies managed holiday worlds", () => {
  assert.equal(sitemapEntryKind("holidays", { url: "https://vii.spaplus.co/holidays/hanukkah" }), "holiday-worlds");
});
