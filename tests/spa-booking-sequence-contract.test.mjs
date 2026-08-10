import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const picker = readFileSync("app/components/spa-appointment-picker.tsx", "utf8");
const booking = readFileSync("app/booking/client-page.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");
const locale = readFileSync("app/i18n/locale-provider.tsx", "utf8");

test("spa booking starts with two guests and requires their composition", () => {
  assert.match(picker, /Number\(initialGuests \|\| 2\)/);
  assert.match(picker, /participants !== 2 \|\| Boolean\(composition\)/);
  assert.match(picker, /id: "mixed", label: "גבר ואישה"/);
  assert.match(picker, /id: "men", label: "שני גברים"/);
  assert.match(picker, /id: "women", label: "שתי נשים"/);
  assert.match(picker, /name="spaComposition"[\s\S]*required/);
});

test("date and time are gated in the requested order", () => {
  assert.match(picker, /disabled=\{!participantsReady \|\| date < today\}/);
  assert.match(picker, /if \(!selectedDate \|\| !participantsReady\) return \[\]/);
  assert.match(picker, /ready: Boolean\(date && time && \(guests !== 2 \|\| nextComposition\)\)/);
  assert.match(picker, /אלו שעות לבקשה, לא זמינות חיה/);
});

test("spa selection is synchronized with the booking payload and summary", () => {
  assert.match(booking, /initialGuests=\{props\.initialGuests\}/);
  assert.match(booking, /setArrival\(selection\.date\)/);
  assert.match(booking, /setGuests\(String\(selection\.guests\)\)/);
  assert.match(booking, /setSpaComposition\(selection\.compositionLabel\)/);
  assert.match(booking, /values\.get\("spaCompositionLabel"\)/);
  assert.match(booking, /props\.world !== "spa" \? <label>כמות אורחים או משתתפים/);
});

test("participant controls have responsive styling and localized copy", () => {
  assert.match(css, /\.spa-appointment__participants \{ display: grid/);
  assert.match(css, /\.spa-appointment__composition > div \{ display: grid; grid-template-columns: repeat\(3/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.spa-appointment__participants \{ grid-template-columns: 1fr/);
  for (const language of ["en", "ru", "fr"]) assert.match(locale, new RegExp(`${language}: \\{[\\s\\S]*?"מי מגיע ומתי\\?"`));
});
