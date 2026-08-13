import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../app/lib/vacation-date-range.ts", import.meta.url);

test("a visible Hebrew date label recovers the structured stay used by result cards", async () => {
  const source = await (await import("node:fs/promises")).readFile(moduleUrl, "utf8");
  assert.match(source, /parseDisplayLabel/);
  assert.match(source, /he: \/\\s\+עד\\s\+\//);
  assert.match(source, /return displayLabel \? parseDisplayLabel/);
});

test("search and result cards share the recovered structured date range", async () => {
  const fs = await import("node:fs/promises");
  const searchBox = await fs.readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
  const searchPage = await fs.readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8");
  assert.match(searchBox, /vacationStayFromSearch\(searchParams, language\)/);
  assert.match(searchBox, /vacationStayFromSearch\(searchParams, activeRouteLanguage\(language\)\)/);
  assert.match(searchBox, /if \(!from \|\| !till\) return explicitLabel \|\| defaultDateLabel\(mode\)/);
  assert.match(searchBox, /const visibleDates = mode === "vacation"/);
  assert.match(searchPage, /vacationStayFromSearch\(searchParams, language\)/);
  assert.match(searchPage, /params\.set\("from", selectedStay\.from\)/);
  assert.match(searchPage, /params\.set\("till", selectedStay\.till\)/);
  assert.match(searchPage, /params\.delete\("dates"\)/);
});
