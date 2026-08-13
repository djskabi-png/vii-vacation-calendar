import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile guest picker closes independently and keeps search available", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /const closeGuestPicker = useCallback\(\(\) => \{\s*setGuestOpen\(false\);\s*setMobileStep\("overview"\);\s*if \(window\.matchMedia\("\(max-width: 820px\)"\)\.matches\) setMobileExpanded\(true\);\s*\}, \[\]\);/);
  assert.doesNotMatch(source, /onClick=\{cancelMobileSearch\} aria-label="סגירת בחירת האורחים"/);
  assert.match(source, /aria-expanded=\{guestOpen\}[\s\S]*?if \(guestOpen\) \{ closeGuestPicker\(\); return; \}[\s\S]*?setGuestOpen\(true\)/);
  assert.match(source, /className="popover-done" onClick=\{closeGuestPicker\}>שמירת ההרכב/);
  assert.match(styles, /\.search-box-shell\.mobile-expanded \.search-submit,[\s\S]*?\.search-box\.mobile-step-overview \.search-submit \{ display: flex; \}/);
});
