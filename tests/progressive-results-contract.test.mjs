import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("persistent in-view progressive results request every new controlled window without a timer race", () => {
  const source = readFileSync(new URL("../app/components/progressive-results.tsx", import.meta.url), "utf8");
  assert.match(source, /sentinelVisible/);
  assert.match(source, /lastRequestedCount\.current === effectiveVisibleCount/);
  assert.match(source, /lastRequestedCount\.current = effectiveVisibleCount/);
  assert.doesNotMatch(source, /loadingRef|setTimeout\(\(\) => \{ loadingRef/);
});
