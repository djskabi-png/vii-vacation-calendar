import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");

test("closing any mobile date flow returns to the unchanged page", () => {
  assert.match(source, /const closeMobileSearch = useCallback\(\(\) => \{[\s\S]*?setCalendarOpen\(false\);[\s\S]*?setLocationOpen\(false\);[\s\S]*?setGuestOpen\(false\);[\s\S]*?setMobileExpanded\(false\);[\s\S]*?setMobileStep\("overview"\);/);
  assert.match(source, /const restoreCommittedSearchState = useCallback\(\(\) => \{[\s\S]*?setLocationValue\([\s\S]*?setDates\([\s\S]*?setVacationDateRange\([\s\S]*?setVacationParty\(/);
  assert.match(source, /const cancelMobileSearch = useCallback\(\(\) => \{[\s\S]*?restoreCommittedSearchState\(\);[\s\S]*?closeMobileSearch\(\);/);
  assert.equal((source.match(/onCancel=\{cancelMobileSearch\}/g) || []).length, 3);
  assert.equal((source.match(/onClose=\{\(\) => setCalendarOpen\(false\)\}/g) || []).length, 3);
  assert.match(source, /className="search-mobile-backdrop" onClick=\{cancelMobileSearch\}/);
  assert.match(source, /!mobileExpanded && \(locationOpen \|\| guestOpen \|\| priceOpen\)[\s\S]*?className="search-option-backdrop" onClick=\{cancelMobileSearch\}/);
  assert.match(source, /event\.key === "Escape"\) cancelMobileSearch\(\)/);
  assert.match(source, /const closeGuestPicker = useCallback\(\(\) => \{[\s\S]*?setGuestOpen\(false\);[\s\S]*?setMobileStep\("overview"\);[\s\S]*?setMobileExpanded\(true\);/);
  assert.match(source, /onClick=\{closeGuestPicker\} aria-label="סגירת בחירת האורחים"/);
  assert.match(source, /if \(guestOpen\) \{ closeGuestPicker\(\); return; \}/);
});

test("submitting a search closes every open search layer before showing results", () => {
  assert.match(source, /function search\(\) \{[\s\S]*?setIsSearching\(true\);[\s\S]*?closeMobileSearch\(\);/);
  assert.match(source, /const closeMobileSearch = useCallback\(\(\) => \{[\s\S]*?setPriceOpen\(false\);[\s\S]*?setMobileExpanded\(false\);/);
});

test("the mobile header closes the active guest section before cancelling the search", () => {
  assert.match(source, /const closeActiveMobileSection = useCallback\(\(\) => \{[\s\S]*?if \(guestOpen\) \{[\s\S]*?closeGuestPicker\(\);[\s\S]*?return;[\s\S]*?cancelMobileSearch\(\);/);
  assert.match(source, /onClick=\{closeActiveMobileSection\} aria-label=\{guestOpen \? /);
});
