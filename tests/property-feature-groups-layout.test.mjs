import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("desktop property feature groups pack by content height without empty grid cells", () => {
  assert.match(css, /\.property-feature-groups\s*\{[^}]*columns:\s*2[^}]*column-gap:/s);
  assert.match(css, /\.property-feature-groups article\s*\{[^}]*display:\s*inline-block[^}]*break-inside:\s*avoid[^}]*margin:\s*0 0 12px/s);
});

test("narrow layouts do not keep the two-column masonry layout", () => {
  assert.match(css, /@media[^{}]*max-width:[^{}]*\{[\s\S]*?\.property-feature-groups\s*\{\s*columns:\s*1;/s);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.feature-section > \.property-feature-groups,[\s\S]*?display:\s*none;/s);
});
