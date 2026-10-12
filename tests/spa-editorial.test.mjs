import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../app/data/spaplus-catalog.json" with { type: "json" };
import { spaEditorialDescription, spaEditorialSummary, spaEditorialTitle } from "../app/data/spa-editorial.ts";
import { GET } from "../app/api/spa/source-description/route.ts";

test("every catalog spa gets unique VII copy and metadata from verified fields", () => {
  const summaries = catalog.sites.map(spaEditorialSummary);
  const titles = catalog.sites.map(spaEditorialTitle);
  const descriptions = catalog.sites.map(spaEditorialDescription);
  assert.equal(new Set(summaries).size, catalog.sites.length);
  assert.equal(new Set(titles).size, catalog.sites.length);
  assert.equal(new Set(descriptions).size, catalog.sites.length);
  for (const [index, site] of catalog.sites.entries()) {
    assert.ok(summaries[index].includes(site.title));
    assert.ok(descriptions[index].includes(site.title));
    assert.ok(titles[index].includes(site.title));
    assert.notEqual(summaries[index], site.shortDescription);
    assert.equal(site.about.some((paragraph) => summaries[index] === paragraph), false);
  }
});

test("read more can recover the complete approved supplier description", async () => {
  const site = catalog.sites.find((entry) => entry.id === 6);
  const response = await GET(new Request("https://vii.spaplus.co/api/spa/source-description?id=6"));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).about, site.about);
  const missing = await GET(new Request("https://vii.spaplus.co/api/spa/source-description?id=99999999"));
  assert.equal(missing.status, 404);
});
