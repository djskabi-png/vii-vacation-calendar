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
  assert.match(picker, /<ModernSelect/);
  assert.match(picker, /שעת הגעה משוערת, לא חובה/);
  assert.match(picker, /אין להגיע לפני השעה שאושרה/);
  assert.doesNotMatch(picker, /const TIMES =/);
  assert.match(picker, /type="hidden" name="time"/);
});

test("arrival preference is compact, optional, and stays touch-friendly on mobile", () => {
  assert.doesNotMatch(booking, /!preferredTime/);
  assert.match(booking, /!arrival \|\| \(props\.world === "vacation" && !departure\)/);
  assert.match(css, /\.booking-schedule__days button \{[^}]*min-height: 44px/s);
  assert.match(css, /\.booking-schedule__time-optional \{[^}]*grid-template-columns: minmax\(190px,240px\) minmax\(0,1fr\)/s);
  assert.match(css, /\.booking-schedule__time-optional \.modern-select__trigger \{[^}]*min-height: 44px/s);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.booking-schedule__time-optional \{[^}]*grid-template-columns: 1fr/s);
});
