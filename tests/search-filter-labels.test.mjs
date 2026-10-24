import test from "node:test";
import assert from "node:assert/strict";
import { searchFilterSummary, searchFilterValueLabel } from "../app/lib/search-filter-labels.ts";

test("search-page administration never exposes raw boolean or feature slugs", () => {
  assert.equal(searchFilterValueLabel("accessible", true), "נגיש לנכים");
  assert.equal(searchFilterValueLabel("online", true), "ניתן להזמין אונליין");
  assert.equal(searchFilterValueLabel("features", "covered-heated-pool,families"), "בריכה מחוממת ומקורה · מתאים למשפחות");
  assert.deepEqual(searchFilterSummary({ accessible: true, features: "private-pool,couples" }), [
    "נגישות: נגיש לנכים", "מאפיינים: בריכה פרטית · מתאים לזוגות",
  ]);
});
