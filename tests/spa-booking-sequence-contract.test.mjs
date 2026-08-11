import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const picker = readFileSync("app/components/spa-appointment-picker.tsx", "utf8");
const booking = readFileSync("app/booking/client-page.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");
const locale = readFileSync("app/i18n/locale-provider.tsx", "utf8");

test("spa booking derives participant defaults from the selected package and requires the relevant composition", () => {
  assert.match(picker, /offerAudience\?: string/);
  assert.match(picker, /offerAudience === "יחיד" \? 1/);
  assert.match(picker, /offerAudience === "זוג" \? 2/);
  assert.match(picker, /offerAudience === "קבוצה" \? 3/);
  assert.match(picker, /id: "man", label: "גבר"/);
  assert.match(picker, /id: "woman", label: "אישה"/);
  assert.match(picker, /id: "mixed", label: "גבר ואישה"/);
  assert.match(picker, /participants > 2 \|\| Boolean\(composition\)/);
  assert.match(picker, /compositionOptions\.length \? <fieldset/);
  assert.match(picker, /name="spaComposition"[\s\S]*required/);
});

test("date and time are gated in the requested order", () => {
  assert.match(picker, /disabled=\{!participantsReady \|\| date < today\}/);
  assert.match(picker, /if \(!selectedDate \|\| !participantsReady\) return \[\]/);
  assert.match(picker, /ready: Boolean\(date && time && \(guests > 2 \|\| nextComposition\)\)/);
  assert.match(picker, /אלו שעות לבקשה, לא זמינות חיה/);
});

test("spa selection is synchronized with the booking payload and summary", () => {
  assert.match(booking, /initialGuests=\{props\.initialGuests\}/);
  assert.match(booking, /offerAudience=\{props\.offerAudience\}/);
  assert.match(booking, /setArrival\(selection\.date\)/);
  assert.match(booking, /setGuests\(String\(selection\.guests\)\)/);
  assert.match(booking, /setSpaComposition\(selection\.compositionLabel\)/);
  assert.match(booking, /setSpaTime\(selection\.time\)/);
  assert.match(booking, /values\.get\("spaCompositionLabel"\)/);
  assert.match(booking, /props\.world !== "spa" \? <label>כמות אורחים או משתתפים/);
});

test("spa package details and the schedule handoff stay in the booking contract", () => {
  assert.match(booking, /props\.offerIncludes\.join\(", "\)/);
  assert.match(booking, /props\.offerDuration/);
  assert.match(booking, /offerName=\{props\.offerName\}/);
  assert.match(picker, /גמישים בשעה/);
  assert.match(picker, /רק השעות הפנויות בפועל/);
  assert.match(css, /\.spa-appointment__offer/);
  assert.match(css, /\.booking-summary__package/);
});

test("participant controls have responsive styling and localized copy", () => {
  assert.match(css, /\.spa-appointment__participants \{ display: grid/);
  assert.match(css, /\.spa-appointment__composition > div \{ display: grid; grid-template-columns: repeat\(3/);
  assert.match(css, /\.spa-appointment__composition--single > div \{ grid-template-columns: repeat\(2/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.spa-appointment__participants \{ grid-template-columns: 1fr/);
  for (const language of ["en", "ru", "fr"]) assert.match(locale, new RegExp(`${language}: \\{[\\s\\S]*?"מי מגיע ומתי\\?"`));
});
