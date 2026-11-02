import assert from "node:assert/strict";
import test from "node:test";
import publications from "../app/data/legacy-search-page-publications.json" with { type: "json" };
import { buildVacationSearchUrl } from "../app/lib/vacation-search-url.ts";
import { canonicalLegacyVacationSearchPath, completeLegacySearchFilters, completeLegacySearchSourcePath, legacyCanonicalIntentCount } from "../app/lib/legacy-search-intent.ts";
import { matchesVacationAccommodationType } from "../app/lib/vacation-search-filter-index.ts";

const page = (title) => publications.pages.find((item) => item.title === title);

test("legacy titles restore search semantics that were lost during migration", () => {
  const nationwide = page("צימרים עם בריכה");
  const north = page("צימרים בצפון עם בריכה");
  assert.ok(nationwide);
  assert.ok(north);
  assert.equal(completeLegacySearchFilters(nationwide).features, "pool");
  assert.equal(completeLegacySearchFilters(north).features, "pool");
  assert.match(completeLegacySearchSourcePath(nationwide), /features=pool/);
  assert.match(completeLegacySearchSourcePath(north), /features=pool/);
});

test("approved type, location and feature combinations resolve to existing indexable pages", () => {
  assert.equal(canonicalLegacyVacationSearchPath({ location: "כל הארץ", type: "צימרים", features: ["pool"] }), page("צימרים עם בריכה").canonicalPath);
  assert.equal(canonicalLegacyVacationSearchPath({ location: "צפון", type: "צימרים", features: ["pool"] }), page("צימרים בצפון עם בריכה").canonicalPath);
  assert.ok(legacyCanonicalIntentCount() > 100, "the lock must cover the migrated semantic family, not one screenshot");
});

test("filter interactions use the canonical page while transactional searches keep their exact state", () => {
  assert.equal(buildVacationSearchUrl("", { pool: "1" }, ["צימרים"], "כל הארץ"), page("צימרים עם בריכה").canonicalPath);
  assert.equal(buildVacationSearchUrl("", { pool: "1" }, ["צימרים"], "צפון"), page("צימרים בצפון עם בריכה").canonicalPath);
  assert.equal(buildVacationSearchUrl("?from=2026-11-20&till=2026-11-22", { pool: "1" }, ["צימרים"], "צפון"), "/zimmers/north?from=2026-11-20&till=2026-11-22&pool=1");
});

test("qualified pool pages never collapse into the generic pool intent", () => {
  const privatePool = page("צימרים עם בריכה פרטית");
  assert.ok(privatePool);
  assert.equal(completeLegacySearchFilters(privatePool).features, "private-pool");
  assert.notEqual(canonicalLegacyVacationSearchPath({ location: "כל הארץ", type: "צימרים", features: ["pool"] }), privatePool.canonicalPath);
});

test("managed pages include secondary accommodation types instead of checking only the primary type", () => {
  const secondaryZimmer = { type: "סוויטה", types: ["סוויטה", "צימר"], features: [], description: "", location: "", area: "" };
  assert.equal(matchesVacationAccommodationType(secondaryZimmer, "צימרים"), true);
  assert.equal(matchesVacationAccommodationType(secondaryZimmer, "וילות"), false);
});
