import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const calendar = fs.readFileSync(new URL("../app/calendar-demo.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("business calendar uses a bounded two-month desktop window and restores the stay summary", () => {
  assert.match(calendar, /<div className="month-nav calendar-month-nav"/);
  assert.doesNotMatch(calendar, /\{mode === "home" && <div className="month-nav calendar-month-nav"/);
  assert.match(calendar, /className="dialog-date-summary"/);
  assert.match(calendar, /desktopVisible=\{index === visibleMonthIndex \|\| index === visibleMonthIndex \+ 1\}/);
  assert.match(css, /@media \(min-width: 821px\)[\s\S]*\.calendar-dialog \.dialog-months > \.demo-month:not\(\.desktop-visible\) \{ display: none; \}/);
});

test("real listings never fall back to invented business availability", () => {
  assert.match(calendar, /mode === "business" && !illustrative \? \{ kind: "open", units: 0, label: "לבחירה", unknown: true \}/);
  assert.match(calendar, /mode === "business" && state\.kind !== "past" && !state\.unknown/);
  assert.match(calendar, /return calendar \? stayCalendarDay\(calendar, keyOf\(date\)\)\.minimumNights \?\? 1 : illustrative \? minimumNights\(date\) : 1/);
});

test("desktop detail header keeps long business names readable", () => {
  assert.match(css, /grid-template-columns: minmax\(230px, 320px\) minmax\(0, 1fr\) max-content/);
  assert.match(css, /\.detail-sticky-dock__identity strong[^}]*-webkit-line-clamp: 2/);
});
