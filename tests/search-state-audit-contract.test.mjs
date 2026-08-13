import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const audit = await readFile(new URL("../scripts/audit-search-state.cjs", import.meta.url), "utf8");

test("the release audit covers every search entry point and responsive transition", () => {
  for (const route of ["home", "vacation-results", "vacation-region", "spa", "spa-region", "events", "hourly"]) {
    assert.match(audit, new RegExp(`\\[\"${route}\"`));
  }
  for (const check of ["mobile-fresh", "guests-open", "guests-close-x", "guests-toggle-close", "desktop-after-mobile", "desktop-horizontal-rails", "desktop-reload", "mobile-return"]) {
    assert.match(audit, new RegExp(`\"${check}\"`));
  }
  assert.match(audit, /horizontal-viewport-drift/);
  assert.match(audit, /search-action-not-visible/);
  assert.match(audit, /stale-mobile-scroll-lock/);
  assert.match(audit, /horizontal-rail-does-not-scroll/);
  assert.match(audit, /visibleMeaningfulElements/);
  assert.match(audit, /largestUnexplainedEmptyBand/);
  assert.match(audit, /no-visible-results-state/);
  assert.match(audit, /excessive-empty-band/);
  assert.match(audit, /page\.screenshot/);
});
