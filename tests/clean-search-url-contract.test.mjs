import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const searchBox = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../app/calendar-demo.tsx", import.meta.url), "utf8");
const urlBuilder = readFileSync(new URL("../app/lib/vacation-search-url.ts", import.meta.url), "utf8");

test("vacation search URLs never write localized date display text", () => {
  assert.doesNotMatch(searchBox, /params\.set\("dates"/);
  assert.match(searchBox, /params\.delete\("dates"\)/);
  assert.match(urlBuilder, /params\.delete\("dates"\)/);
});

test("exact dates use ISO parameters and flexible searches use stable identifiers", () => {
  assert.match(searchBox, /params\.set\("from", vacationDateRange\.from\)/);
  assert.match(searchBox, /params\.set\("till", vacationDateRange\.till\)/);
  assert.match(searchBox, /params\.set\("dateMode", "flexible"\)/);
  assert.match(searchBox, /params\.set\("stay", vacationFlexibleSearch\.stay\)/);
  assert.match(searchBox, /params\.set\("month", vacationFlexibleSearch\.month\)/);
  assert.match(searchBox, /params\.set\("flexDays", String\(vacationFlexibleSearch\.days\)\)/);
});

test("calendar returns flexible IDs separately from localized summary text", () => {
  assert.match(calendar, /flexibleStay:/);
  assert.match(calendar, /flexibleMonth:/);
  assert.match(calendar, /flexibleDays:/);
});

test("flexible date labels use the active route language after hydration", () => {
  assert.match(searchBox, /setDateDisplayLanguage\(languageFromPathname\(window\.location\.pathname\)\)/);
  assert.match(searchBox, /flexibleDateLabel\(vacationFlexibleSearch, dateDisplayLanguage\)/);
  assert.match(searchBox, /dateLabelFromSearch\([\s\S]*dateDisplayLanguage\)/);
});
