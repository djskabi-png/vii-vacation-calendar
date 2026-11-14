import test from "node:test"; import assert from "node:assert/strict"; import pages from "../app/data/legacy-event-search-pages.json" with { type: "json" }; import { canonicalLegacyEventSearchPath } from "../app/lib/legacy-event-intent-index.ts";
test("every captured legacy event intent resolves to its exact canonical path", () => {
  for (const page of pages.filter(page => !page.sourcePath?.includes("legacyPage="))) {
    const input = { location: page.location, ...(page.filters || {}) };
    assert.equal(canonicalLegacyEventSearchPath(input), page.canonicalPath, page.id);
  }
});
test("adding an unrepresented filter never broadens to an existing intent", () => {
  for (const page of pages.filter(page => !page.sourcePath?.includes("legacyPage="))) assert.equal(canonicalLegacyEventSearchPath({ location: page.location, ...(page.filters || {}), noise: "1" }), null, page.id);
});
test("known singular aliases normalize, while unknown values and contradictory filters stay unresolved", () => {
  const typePage = pages.find(page => page.filters?.type);
  assert.ok(typePage);
  assert.equal(canonicalLegacyEventSearchPath({ location: typePage.location, type: typePage.filters.type.replace(/ים$/, "") }), typePage.canonicalPath);
  assert.equal(canonicalLegacyEventSearchPath({ location: typePage.location, type: "סוג שלא קיים" }), null);
  assert.equal(canonicalLegacyEventSearchPath({ location: typePage.location, type: typePage.filters.type, accessible: "1" }), null);
});
test("feature ordering is semantic and does not collapse unknown combinations", () => {
  const featurePage = pages.find(page => page.filters?.features);
  assert.ok(featurePage);
  const parts = featurePage.filters.features.split(",");
  assert.equal(canonicalLegacyEventSearchPath({ location: featurePage.location, features: parts.reverse().join(",") }), featurePage.canonicalPath);
  assert.equal(canonicalLegacyEventSearchPath({ location: featurePage.location, features: `${featurePage.filters.features},amenity-999999` }), null);
});
