import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const search = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const taxonomy = readFileSync(new URL("../app/data/search-taxonomy.ts", import.meta.url), "utf8");
const css = readEffectiveWorldCss();

test("vacation destination picker preserves the complete legacy discovery set", () => {
  for (const heading of ["אזורים ראשיים מומלצים", "אזורים מומלצים", "יישובים מומלצים"]) {
    assert.match(taxonomy, new RegExp(heading));
  }
  for (const destination of ["כל הארץ", "צפון", "מרכז", "דרום", "גליל מערבי", "גליל עליון", "אילת והערבה", "כנרת", "מישור החוף והשפלה", "ירושלים והרי יהודה", "שרון", "רמת הגולן", "אילת", "ירכא", "נוף כנרת", "מגדל", "דלתון", "נתניה", "יערה", "טבריה", "חדרה", "יבנאל", "חוסן", "פקיעין החדשה", "קיסריה", "אבן מנחם", "כלנית"]) {
    assert.match(taxonomy, new RegExp(destination));
  }
});

test("destination picker offers nearby search, grouped discovery and useful filtering", () => {
  const nearby = readFileSync(new URL("../app/components/use-nearby-sort.tsx", import.meta.url), "utf8");
  assert.match(nearby, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(search, /requestNearbyOrigin/);
  assert.match(search, /searchParams\.set\("sort", "nearest"\)/);
  assert.match(search, /className="location-nearby"/);
  assert.match(search, /vacationLocationGroups\.flatMap/);
  assert.match(search, /className="location-search-results"/);
  assert.match(search, /chooseLocation\(place\)/);
  assert.match(search, /pickerCopy\.browse/);
  assert.match(search, /translate\(place\)/);
  assert.match(search, /const nearbyLabel = mode in nearbyPageContent/);
  assert.match(search, /translate\(nearbyLabel\)/);
  assert.match(css, /\.location-group--primary > div\s*\{[^}]*repeat\(4/s);
  assert.match(css, /mobile-expanded \.location-group--primary > div\s*\{[^}]*repeat\(2/s);
  assert.match(css, /mobile-expanded \.location-group--regions > div\s*\{[^}]*repeat\(2/s);
  assert.match(css, /\.location-list\s*\{[^}]*overflow-y:\s*auto/s);
});

test("choosing a destination searches immediately on desktop and advances the staged flow on mobile", () => {
  const chooseLocationBody = search.slice(search.indexOf("function chooseLocation"), search.indexOf("async function chooseNearbyLocation"));
  assert.match(
    chooseLocationBody,
    /function chooseLocation\(place: string, nearest = false\)[\s\S]*?const selectedLocation = canonicalSearchLocation\(place\);[\s\S]*?setLocationOpen\(false\);[\s\S]*?if \(isDesktopSearchViewport\(\)\) \{[\s\S]*?search\(\{ location: selectedLocation \}\);[\s\S]*?return;[\s\S]*?\}/,
  );
  assert.match(chooseLocationBody, /if \(isHourly\)[\s\S]*?setMobileStep\("overview"\)[\s\S]*?return;[\s\S]*?setMobileStep\("dates"\);[\s\S]*?setCalendarOpen\(true\);/);
});
