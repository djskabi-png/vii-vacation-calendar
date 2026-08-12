import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const search = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const taxonomy = readFileSync(new URL("../app/data/search-taxonomy.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("vacation destination picker preserves the complete legacy discovery set", () => {
  for (const heading of ["אזורים ראשיים מומלצים", "אזורים מומלצים", "יישובים מומלצים"]) {
    assert.match(taxonomy, new RegExp(heading));
  }
  for (const destination of ["כל הארץ", "צפון", "מרכז", "דרום", "גליל מערבי", "גליל עליון", "אילת והערבה", "כנרת", "מישור החוף והשפלה", "ירושלים והרי יהודה", "שרון", "רמת הגולן", "אילת", "ירכא", "נוף כנרת", "מגדל", "דלתון", "נתניה", "יערה", "טבריה", "חדרה", "יבנאל", "חוסן", "פקיעין החדשה", "קיסריה", "אבן מנחם", "כלנית"]) {
    assert.match(taxonomy, new RegExp(destination));
  }
});

test("destination picker offers nearby search, grouped discovery and useful filtering", () => {
  assert.match(search, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(search, /className="location-nearby"/);
  assert.match(search, /vacationLocationGroups\.map/);
  assert.match(search, /className="location-search-results"/);
  assert.match(search, /chooseLocation\(place\)/);
  assert.match(search, /translate\(group\.title\)/);
  assert.match(search, /translate\(place\)/);
  assert.match(search, /translate\("מקומות בסביבה הקרובה"\)/);
  assert.match(css, /\.location-group--primary > div\s*\{[^}]*repeat\(4/s);
  assert.match(css, /mobile-expanded \.location-group--primary > div\s*\{[^}]*repeat\(2/s);
  assert.match(css, /mobile-expanded \.location-group--regions > div\s*\{[^}]*repeat\(2/s);
  assert.match(css, /\.location-list\s*\{[^}]*overflow-y:\s*auto/s);
});

test("choosing a destination on mobile advances directly to the date picker", () => {
  assert.match(
    search,
    /function chooseLocation\(place: string\)[\s\S]*?setLocationOpen\(false\);[\s\S]*?setMobileStep\("dates"\);[\s\S]*?setCalendarOpen\(true\);/,
  );
});
