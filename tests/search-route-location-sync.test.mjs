import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");

test("a regional results route keeps its route location when no location query exists", () => {
  assert.equal((source.match(/requestedLocation\s*\?\s*\(isWholeCountrySelection\(requestedLocation\)/g) || []).length, 2);
  assert.doesNotMatch(source, /isWholeCountrySelection\(requestedLocation\)\s*\?\s*"כל הארץ"\s*:\s*requestedLocation\s*\|\|\s*initialLocation/);
});

test("an explicit whole-country query still overrides a regional default", () => {
  assert.match(source, /requestedLocation\s*\?\s*\(isWholeCountrySelection\(requestedLocation\)\s*\?\s*"כל הארץ"\s*:\s*requestedLocation\)\s*:\s*initialLocation\s*\|\|\s*"כל הארץ"/);
});
