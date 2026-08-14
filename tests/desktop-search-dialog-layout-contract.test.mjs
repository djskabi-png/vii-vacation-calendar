import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const search = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../app/calendar-demo.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("destination editor uses the shared rounded dialog structure", () => {
  assert.match(search, /className="search-popover location-list" role="dialog" aria-modal="true"/);
  assert.match(search, /className="location-list__header"/);
  assert.match(search, /className="location-list__close"[^>]*onClick=\{closeLocationPicker\}/);
  assert.match(search, /className="location-list__body"/);
  assert.match(search, /event\.key !== "Escape"/);
  assert.match(css, /\.location-list\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.location-list\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\)/);
  assert.match(css, /\.location-list__body::\-webkit-scrollbar\s*\{\s*display:\s*none/);
  assert.match(css, /@media \(min-width: 821px\)[\s\S]*?\.location-list\s*\{[\s\S]*?position:\s*fixed[\s\S]*?transform:\s*translate\(-50%,\s*-50%\)/);
  assert.match(css, /\.location-list \.location-group--primary > div,[\s\S]*?grid-template-columns:\s*repeat\(4/);
});

test("desktop calendar pages months without an exposed outer scrollbar", () => {
  assert.match(calendar, /const \[visibleMonthIndex, setVisibleMonthIndex\] = useState\(0\)/);
  assert.match(calendar, /className="month-nav calendar-month-nav"/);
  assert.match(calendar, /desktopVisible=\{index === visibleMonthIndex \|\| index === visibleMonthIndex \+ 1\}/);
  assert.match(css, /\.calendar-dialog\.mode-home\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.calendar-dialog\.mode-home \.dialog-months > \.demo-month:not\(\.desktop-visible\)\s*\{\s*display:\s*none/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.calendar-month-nav\s*\{\s*display:\s*none/);
});
