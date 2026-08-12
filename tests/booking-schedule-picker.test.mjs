import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const picker = await readFile(new URL("../app/components/booking-schedule-picker.tsx", import.meta.url), "utf8");
const booking = await readFile(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("booking uses branded date and time controls instead of browser-native pickers", () => {
  assert.match(booking, /<BookingSchedulePicker/);
  assert.doesNotMatch(booking, /type="date"/);
  assert.doesNotMatch(booking, /type="time"/);
  assert.match(picker, /booking-schedule__calendar/);
  assert.match(picker, /booking-schedule__times/);
  assert.match(picker, /type="hidden" name="time"/);
});

test("booking schedule remains touch-friendly on mobile", () => {
  assert.match(css, /\.booking-schedule__days button \{[^}]*min-height: 44px/s);
  assert.match(css, /\.booking-schedule__times button \{[^}]*min-height: 46px/s);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.booking-schedule__times > div \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\); \}/);
});