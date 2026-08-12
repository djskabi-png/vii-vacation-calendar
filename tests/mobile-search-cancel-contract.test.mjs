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
  assert.match(source, /className="search-option-backdrop" onClick=\{cancelMobileSearch\}/);
  assert.match(source, /event\.key === "Escape"\) cancelMobileSearch\(\)/);
  assert.match(source, /onClick=\{cancelMobileSearch\} aria-label="סגירת בחירת האורחים"/);
});

test("submitting a search closes every open search layer before showing results", () => {
  assert.match(source, /function search\(\) \{[\s\S]*?setIsSearching\(true\);[\s\S]*?closeMobileSearch\(\);/);
  assert.match(source, /const closeMobileSearch = useCallback\(\(\) => \{[\s\S]*?setPriceOpen\(false\);[\s\S]*?setMobileExpanded\(false\);/);
});
