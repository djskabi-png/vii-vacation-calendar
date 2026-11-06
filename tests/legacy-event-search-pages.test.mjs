import test from "node:test";
import assert from "node:assert/strict";
import pages from "../app/data/legacy-event-search-pages.json" with { type: "json" };
import { legacyDisposition } from "../app/lib/legacy-route-map.ts";

test("all captured legacy event search pages have unique approved canonical paths and exact redirects", () => {
  assert.equal(pages.length, 64);
  assert.equal(new Set(pages.map(page => page.canonicalPath)).size, pages.length);
  assert.ok(pages.some(page => page.filters?.type === "מתחמי אירוח"));
  assert.ok(pages.some(page => typeof page.filters?.features === "string" && page.filters.features.includes("amenity-27")));
  for (const page of pages) {
    const result = legacyDisposition(page.legacySourcePath);
    assert.deepEqual(result, { status: 301, target: page.canonicalPath }, page.legacySourcePath);
    assert.ok(page.filters && Object.keys(page.filters).length >= 0);
    assert.ok(page.latestResultCount > 0, page.legacySourcePath);
  }
});

test("empty Qiryat Atta legacy alias uses the existing semantic city page", () => {
  assert.deepEqual(legacyDisposition("/events/s/Qiryat_Atta/11235130831"), { status: 301, target: "/events/search/kiryat-ata" });
});
