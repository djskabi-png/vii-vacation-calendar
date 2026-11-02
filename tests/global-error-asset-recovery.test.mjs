import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/global-error.tsx", import.meta.url), "utf8");

test("a stale deployment asset triggers one bounded hard reload", () => {
  assert.match(source, /dynamically imported module/);
  assert.match(source, /sessionStorage\.getItem/);
  assert.match(source, /Date\.now\(\) - lastAttempt < 60_000/);
  assert.match(source, /window\.location\.reload\(\)/);
});

test("ordinary application errors still use the React reset boundary", () => {
  assert.match(source, /assetLoadFailure \? window\.location\.reload\(\) : reset\(\)/);
});
