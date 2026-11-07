import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/components/slider-rail-controls.tsx", import.meta.url), "utf8");

test("slider controls normalize a streamed replacement without overriding user interaction", () => {
  assert.match(source, /settleInterval = window\.setInterval\(normalize, 100\)/);
  assert.match(source, /if \(userInteracted \|\| controlInteracted\.current\) return/);
  assert.match(source, /rail\.contains\(event\.target\)\) userInteracted = true/);
  assert.match(source, /window\.clearInterval\(settleInterval\)/);
});
