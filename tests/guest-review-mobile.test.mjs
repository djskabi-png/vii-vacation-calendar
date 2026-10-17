import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/components/guest-review-studio.tsx", import.meta.url), "utf8");

test("review cards keep full text available through a localized mobile toggle", () => {
  assert.match(source, /review-card__toggle/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /aria-controls=\{reviewContentId\}/);
  assert.match(source, /review-card--expandable/);
  assert.match(source, /review\.response/);
  assert.match(source, /SliderRailControls/);
  assert.match(source, /itemSelector=":scope > \.review-card"/);
  assert.match(source, /useId/);
  assert.match(source, /readMore:/);
  assert.match(source, /readLess:/);
});
