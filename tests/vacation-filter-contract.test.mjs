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
  assert.match(source, /type="checkbox" checked=\{shownFilters\.selectedTypes\.includes\(item\.label\)\}/);
  assert.match(source, /selectedTypes\.some/);
  assert.match(source, /legacyType\.matches\.some/);
  assert.match(source, /label: "בקתות עץ", matches: \["בקתת עץ", "בקתות עץ"\]/);
  assert.match(source, /label: "צימרים", matches: \["צימר", "צימרים"\]/);
});

test("vacation accommodation controls keep visible focus and responsive layout", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(css, /\.vacation-filter-sections button:focus-visible/);
  assert.match(css, /\.vacation-type-options[^}]*grid-template-columns:\s*repeat\(2/);
});

test("vacation search includes the complete legacy additional filters", async () => {
  const source = await readFile(new URL("app/search/page.tsx", root), "utf8");
  for (const heading of ["כללי", "מתחם חיצוני", "מתחם פנימי", "קהלי יעד"]) assert.match(source, new RegExp(heading));
  for (const label of ["נגישות לנכים", "מקבלים בעלי חיים", "רישיון עסק", "חניה חינם", "בריכת שחייה מחוממת ומקורה", "בריכת ילדים", "בריכת שחייה פרטית", "בריכת זרמים", "בריכת שחייה מגודרת", "ג׳קוזי ספא מחומם ומקורה", "מטבח מאובזר", "אינטרנט אלחוטי", "קמין עצים", "עמדת קריוקי", "חדר משחקים", "מתאים לאירועים", "משפחות", "סוויטה לזוגות בלבד", "הצעות נישואין", "שבתות חתן", "חתונות"]) assert.match(source, new RegExp(label));
  assert.match(source, /selectedExtras\.every/);
  assert.match(source, /searchableFacts\.includes/);
  assert.match(source, /label: "חניה חינם", matches: \["חניה חינם"\]/);
  assert.match(source, /label: "מטבח מאובזר", matches: \["מטבח מאובזר"\]/);
  assert.match(source, /label: "מבודדת", matches: \["מבודד", "מבודדת"\]/);
});

test("mobile vacation filters use a draft and apply contract", async () => {
  const source = await readFile(new URL("app/search/page.tsx", root), "utf8");
  assert.match(source, /const \[draftFilters, setDraftFilters\]/);
  assert.match(source, /function openFiltersPanel\(\)/);
  assert.match(source, /function closeFiltersPanel\(\)/);
  assert.match(source, /function applyFilters\(\)/);
  assert.match(source, /onClick=\{applyFilters\}/);
  assert.match(source, /onClick=\{closeFiltersPanel\}/);
  assert.match(source, /checked=\{shownFilters\.selectedTypes\.includes\(item\.label\)\}/);
  assert.match(source, /function toggleType\(nextType: string\)/);
  assert.match(source, /types: draftFilters\.selectedTypes\.length > 1/);
  assert.match(source, /draftResultCount/);
  assert.doesNotMatch(source, /type="radio" name="vacation-accommodation-type"/);
});

test("mobile vacation filter actions stay fixed across both filter sections", async () => {
  const source = await readFile(new URL("app/search/page.tsx", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(source, /className="filter-panel__scroll"/);
  assert.match(source, /className="filter-panel__actions"/);
  assert.match(css, /\.filter-panel\.open \.filter-panel__scroll[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.filter-panel\.open \.filter-panel__actions[^}]*flex:\s*none/);
  assert.match(css, /\.filter-panel\.open \.filter-panel__actions[^}]*border-top:/);
});

test("vacation type choices are OR filters while additional choices are cumulative AND filters", async () => {
  const source = await readFile(new URL("app/search/page.tsx", root), "utf8");
  assert.match(source, /selectedTypes\.length === 0 \|\| selectedTypes\.some/);
  assert.match(source, /shownFilters\.selectedTypes\.length === 0 \|\| shownFilters\.selectedTypes\.some/);
  assert.match(source, /selectedExtras\.every/);
  assert.match(source, /shownFilters\.selectedExtras\.every/);
  assert.match(source, /\.\.\.selectedTypes\.map\(\(selectedType\) => \(\{ id: `type-\$\{selectedType\}`/);
});
