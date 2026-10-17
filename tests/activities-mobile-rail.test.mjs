import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/activities/page.tsx", import.meta.url), "utf8");

test("activities hub trail cards use a bounded mobile rail", () => {
  assert.match(source, /id="activities-trails"/);
  assert.match(source, /trail-grid trail-grid--featured/);
  assert.match(source, /<HomeMobileRail/);
});
