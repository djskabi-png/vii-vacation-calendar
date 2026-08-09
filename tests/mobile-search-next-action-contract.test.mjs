import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const calendar = readFileSync(new URL("../app/calendar-demo.tsx", import.meta.url), "utf8");
const search = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("home date selection advances to guests instead of claiming to show results", () => {
  assert.match(calendar, /mode === "home" \? "הבא"/);
  assert.match(search, /setMobileStep\("guests"\); setGuestOpen\(true\)/);
  assert.match(css, /\.mode-home \.confirm-dates\s*\{[^}]*background:\s*#222;/);
});
