import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const helperSource = await readFile(new URL("../app/lib/vacation-inventory.ts", import.meta.url), "utf8");
const searchSource = await readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const compiled = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleShim = { exports: {} };
new Function("exports", "module", compiled)(moduleShim.exports, moduleShim);
const { propertyUnitCount, vacationInventorySummary } = moduleShim.exports;

test("vacation inventory prefers verified units and falls back safely", () => {
  assert.equal(propertyUnitCount({ units: 4, roomOptions: [{ quantity: 8 }] }), 4);
  assert.equal(propertyUnitCount({ roomOptions: [{ quantity: 2 }, { quantity: 3 }] }), 5);
  assert.equal(propertyUnitCount({}), 1);
});

test("vacation result summary reports complexes and units in every language", () => {
  const listings = [{ units: 3 }, { roomOptions: [{ quantity: 2 }] }, {}];
  assert.equal(vacationInventorySummary(listings, "he"), "3 מתחמים, 6 יחידות נופש");
  assert.equal(vacationInventorySummary(listings, "en"), "3 properties, 6 accommodation units");
  assert.equal(vacationInventorySummary(listings, "ru"), "3 объекта, 6 единиц размещения");
  assert.equal(vacationInventorySummary(listings, "fr"), "3 établissements, 6 unités d’hébergement");
});

test("the visible search result set drives the live inventory summary", () => {
  assert.match(searchSource, /vacationInventorySummary\(displayedResults, language\)/);
  assert.match(searchSource, /className="results-heading__inventory" aria-live="polite"/);
  assert.match(css, /\.results-heading__inventory \{[^}]*font-variant-numeric: tabular-nums/);
});
