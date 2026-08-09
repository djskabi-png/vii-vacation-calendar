import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("vacation search preserves every legacy accommodation type", async () => {
  const source = await readFile(new URL("app/search/page.tsx", root), "utf8");
  for (const label of ["בקתות עץ", "וילות", "דירות נופש", "סוויטות", "מערות", "צימרים מאבן", "צימרים", "מתחמי אירוח", "אוהלים אינדיאנים"]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, />סוגי אירוח<\/button>/);
  assert.match(source, />סינונים נוספים<\/button>/);
  assert.match(source, /type="radio" name="vacation-accommodation-type"/);
  assert.match(source, /legacyType\.matches\.some/);
  assert.match(source, /label: "בקתות עץ", matches: \["בקתת עץ", "בקתות עץ"\]/);
  assert.match(source, /label: "צימרים", matches: \["צימר", "צימרים"\]/);
});

test("vacation accommodation controls keep visible focus and responsive layout", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(css, /\.vacation-filter-sections button:focus-visible/);
  assert.match(css, /\.vacation-type-options[^}]*grid-template-columns:\s*repeat\(2/);
});
