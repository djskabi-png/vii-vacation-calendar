import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");

test("closing any mobile date flow resets the full search sheet", () => {
  assert.match(source, /const closeMobileSearch = useCallback\(\(\) => \{[\s\S]*?setCalendarOpen\(false\);[\s\S]*?setLocationOpen\(false\);[\s\S]*?setGuestOpen\(false\);[\s\S]*?setMobileExpanded\(false\);[\s\S]*?setMobileStep\("location"\);/);
  assert.equal((source.match(/onCancel=\{closeMobileSearch\}/g) || []).length, 3);
  assert.equal((source.match(/onClose=\{\(\) => setCalendarOpen\(false\)\}/g) || []).length, 3);
  assert.match(source, /className="search-mobile-backdrop" onClick=\{closeMobileSearch\}/);
  assert.match(source, /event\.key === "Escape"\) closeMobileSearch\(\)/);
});
