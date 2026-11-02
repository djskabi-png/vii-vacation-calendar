import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");

test("committed search choices navigate immediately with explicit fresh values", () => {
  assert.match(source, /type ImmediateSearchOverrides = \{/);
  assert.match(source, /search\(\{ location: selectedLocation \}\)/);
  assert.match(source, /search\(\{ maximumPrice: price \}\)/);
  assert.match(source, /search\(\{ spaAudience: option\.id \}\)/);
  assert.match(source, /search\(\{ spaDate: selection \}\)/);
  assert.match(source, /search\(\{ vacationParty \}\)/);
  assert.match(source, /search\(\{ eventGuests: guests \}\)/);
});

test("vacation and event dates still advance to guests before search", () => {
  assert.match(source, /setEventDateRange\(\{ from: result\.from, to: result\.to \}\); setMobileStep\("guests"\); setGuestOpen\(true\);/);
  assert.match(source, /setVacationDateRange\(\{ from: result\.checkIn, till: result\.checkOut \}\);[\s\S]*?setMobileStep\("guests"\); setGuestOpen\(true\);/);
  assert.doesNotMatch(source, /setVacationDateRange\(\{ from: result\.checkIn, till: result\.checkOut \}\);[^}]*search\(/);
});

test("one in-flight guard prevents duplicate automatic searches and the Search button remains", () => {
  assert.match(source, /if \(isSearchingRef\.current\) return;/);
  assert.match(source, /isSearchingRef\.current = true;/);
  assert.match(source, /onClick=\{\(\) => search\(\)\}/);
});
