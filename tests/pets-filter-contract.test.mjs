import assert from "node:assert/strict";
import test from "node:test";
import { acceptsPets } from "../app/lib/vacation-search-filter-index.ts";

test("pets filter requires explicit supplier evidence", () => {
  assert.equal(acceptsPets({ searchFilterIds: ["pool"], features: ["בריכה"], description: "מקום יפה" }), false);
  assert.equal(acceptsPets({ searchFilterIds: ["pets"], features: [], description: "" }), true);
  assert.equal(acceptsPets({ features: ["חיות מחמד מתקבלות"], description: "" }), true);
});
