import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const css = readEffectiveWorldCss();

test("desktop committed search choices navigate immediately with explicit fresh values", () => {
  assert.match(source, /type ImmediateSearchOverrides = \{/);
  assert.match(source, /function isDesktopSearchViewport\(\) \{\s*return window\.matchMedia\("\(min-width: 821px\)"\)\.matches;\s*\}/);
  assert.match(source, /search\(\{ location: selectedLocation \}\)/);
  assert.match(source, /search\(\{ maximumPrice: price \}\)/);
  assert.match(source, /search\(\{ spaAudience: option\.id \}\)/);
  assert.match(source, /search\(\{ spaDate: selection \}\)/);
  assert.match(source, /function saveVacationParty\(\)[\s\S]*?if \(isDesktopSearchViewport\(\)\)[\s\S]*?search\(\{ vacationParty \}\)/);
  assert.match(source, /function saveEventGuests\(\)[\s\S]*?if \(isDesktopSearchViewport\(\)\)[\s\S]*?search\(\{ eventGuests: guests \}\)/);
});

test("mobile dates advance to guests while desktop dates search with the newly confirmed values", () => {
  assert.match(source, /const selectedEventDateRange = overrides\.eventDateRange \|\| eventDateRangeRef\.current;/);
  assert.match(source, /const selectedVacationDateRange = overrides\.vacationDateRange \|\| vacationDateRangeRef\.current;/);
  assert.match(source, /eventDateRangeRef\.current = selection;/);
  assert.match(source, /vacationDateRangeRef\.current = selection;/);
  assert.match(source, /if \(isDesktopSearchViewport\(\)\) search\(\{ eventDateRange: selection \}\); else \{ setMobileStep\("guests"\); setGuestOpen\(true\); \}/);
  assert.match(source, /if \(isDesktopSearchViewport\(\)\) search\(\{ vacationDateRange: selection, vacationFlexibleSearch: flexibleSelection \}\); else \{ setMobileStep\("guests"\); setGuestOpen\(true\); \}/);
  assert.match(source, /params\.set\("from", selectedVacationDateRange\.from\)/);
  assert.match(source, /params\.set\("to", selectedEventDateRange\.to\)/);
});

test("mobile final confirmation reads the latest staged location and dates", () => {
  assert.match(source, /locationValueRef\.current = selectedLocation;/);
  assert.match(source, /const selectedLocation = overrides\.location === undefined \? locationValueRef\.current/);
  assert.match(source, /const selectedVacationFlexibleSearch = overrides\.vacationFlexibleSearch === undefined \? vacationFlexibleSearchRef\.current/);
  assert.match(source, /onClick=\{saveVacationParty\}>שמירת ההרכב/);
  assert.match(source, /function saveVacationParty\(\)[\s\S]*?closeGuestPicker\(\);/);
  assert.doesNotMatch(css, /\.search-box-shell\.mobile-expanded \.vacation-party-picker \.popover-done\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /\.search-box-shell\.mobile-expanded \.search-step--guests \.popover-done\s*\{\s*display:\s*none/);
});

test("mobile intermediate choices never bypass the staged journey", () => {
  const location = source.slice(source.indexOf("function chooseLocation"), source.indexOf("async function chooseNearbyLocation"));
  assert.match(location, /if \(isDesktopSearchViewport\(\)\)[\s\S]*?search\(\{ location: selectedLocation \}\);[\s\S]*?setMobileStep\("dates"\);[\s\S]*?setCalendarOpen\(true\);/);
  assert.match(source, /if \(isDesktopSearchViewport\(\)\) search\(\{ maximumPrice: price \}\); else \{ setMobileStep\("overview"\); setMobileExpanded\(true\); \}/);
  assert.match(source, /if \(isDesktopSearchViewport\(\)\) search\(\{ spaDate: selection \}\); else \{ setMobileStep\("guests"\); setGuestOpen\(true\); \}/);
  assert.match(source, /function saveEventGuests\(\)[\s\S]*?closeGuestPicker\(\);/);
});

test("one in-flight guard prevents duplicate automatic searches and the Search button remains", () => {
  assert.match(source, /if \(isSearchingRef\.current\) return;/);
  assert.match(source, /isSearchingRef\.current = true;/);
  assert.match(source, /onClick=\{\(\) => search\(\)\}/);
});
