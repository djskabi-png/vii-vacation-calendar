import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const business = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");

test("desktop property feature groups pack by content height without empty grid cells", () => {
  assert.match(business, /function balanceFeatureGroups/);
  assert.match(business, /height\[column\] \+= 1 \+ Math\.ceil\(group\.items\.length \/ 2\)/);
  assert.match(business, /className="property-feature-groups__column"/);
  assert.match(css, /\.property-feature-groups\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(css, /\.property-feature-groups__column\s*\{[^}]*display:\s*grid;[^}]*align-content:\s*start/s);
});

test("narrow layouts do not keep the two-column masonry layout", () => {
  assert.match(css, /@media[^{}]*max-width:[^{}]*\{[\s\S]*?\.property-feature-groups\s*\{\s*grid-template-columns:\s*1fr;/s);
  assert.match(css, /\.property-feature-groups__column\s*\{\s*display:\s*contents;/s);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.feature-section > \.property-feature-groups,[\s\S]*?display:\s*none;/s);
});
