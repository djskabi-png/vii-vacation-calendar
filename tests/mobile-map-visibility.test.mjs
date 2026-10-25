import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const guard = fs.readFileSync(new URL("../app/components/responsive-viewport-guard.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("mobile map FAB remains available throughout result pages and preserves active maps", () => {
  assert.match(guard, /data-map-results-visible/);
  assert.match(guard, /IntersectionObserver/);
  assert.match(guard, /MutationObserver/);
  assert.match(guard, /threshold: 0/);
  assert.match(guard, /\.results-list, \.trail-explorer/);
  assert.match(guard, /\.attraction-explorer, \.world-map-results/);
  assert.match(guard, /observer\.unobserve\(region\)/);
  assert.doesNotMatch(css, /body:not\(\[data-map-results-visible\]\) \.mobile-map-fab:not\(\.active\)/);
  assert.doesNotMatch(css, /body\[data-world-editorial-reading\] \.mobile-map-fab/);
  assert.match(css, /body:has\(\.search-box-shell\.mobile-expanded\)[\s\S]*\.mobile-map-fab/);
});

test("regional availability cards never have the normal-results map FAB covering them", () => {
  assert.match(guard, /visible.size > 0 && availabilityVisible.size === 0/);
  assert.match(guard, /region.matches\("\.regional-availability"\)/);
  assert.match(guard, /querySelectorAll<HTMLElement>\("\.regional-availability"\)/);
  assert.match(guard, /availabilityVisible.delete\(region\)/);
});

test("event map FAB observes the entire results list, not its zero-height fixed-button toolbar", () => {
  const selectors=guard.match(/button\.closest<HTMLElement>\("([^"]+)"\)/)?.[1].split(", ");
  assert.ok(selectors?.includes(".event-list"));
  const eventPage=fs.readFileSync(new URL("../app/events/search/page.tsx",import.meta.url),"utf8");
  assert.match(eventPage,/section className=\{`event-list results-view/);
  assert.match(eventPage,/results-toolbar__actions[\s\S]*mobile-map-fab/);
});
