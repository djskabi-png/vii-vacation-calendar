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

test("vacation calendar keeps complete month data while business mode restores its selection summary and paging", () => {
  assert.match(calendar, /visibleMonths = Array\.from\(\{ length: 12 \}/);
  assert.match(calendar, /visibleMonths\.map/);
  assert.match(calendar, /mode === "business" \? <div className="dialog-date-summary"/);
  assert.match(calendar, /className="month-nav calendar-month-nav"/);
  assert.match(calendar, /longDate\(checkIn, dateLocale\).*longDate\(checkOut, dateLocale\)/);
  assert.doesNotMatch(css, /\.secondary-month\s*\{[^}]*display:\s*none/);
  assert.match(css, /scroll-snap-type:\s*y proximity/);
  assert.match(calendar, /calendar-dialog-close[^>]*>×<\/button>/);
  assert.match(calendar, /Intl\.DateTimeFormat\(locale, \{ weekday: "narrow" \}\)/);
});
