import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const business = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const booking = await readFile(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8");
const bookingPage = await readFile(new URL("../app/booking/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("vacation online booking requires dates and a positive connected price", () => {
  assert.match(business, /hasSelectedDates = Boolean\(dateRange\.from && dateRange\.till\)/);
  assert.match(business, /hasSelectedPrice = Boolean\(initialPrice && Number\(initialPrice\) > 0\)/);
  assert.match(business, /vacationOnlineReady = activeWorld === "vacation" && hasSelectedDates && hasSelectedPrice/);
  assert.match(bookingPage, /onlineReady: Boolean\(params\.from && params\.till && params\.price && Number\(params\.price\) > 0\)/);
  assert.match(bookingPage, /if \(property\) return \{[\s\S]*?world: "vacation"/);
  assert.doesNotMatch(booking, /onlineReady\s*=\s*isManage\s*\|\|/);
});

test("incomplete vacation data keeps availability date-first and preserves the booking phone fallback", () => {
  assert.match(business, /vacationPhoneFallback = activeWorld === "vacation" && !vacationOnlineReady/);
  assert.match(business, /בחירת תאריכים ובדיקת זמינות/);
  assert.doesNotMatch(business, /phoneRevealed \? <a className="phone-reveal phone-reveal--visible"/);
  assert.match(booking, /if \(!onlineReady\)/);
  assert.match(booking, /phoneRevealed \? <a className="phone-reveal phone-reveal--visible"/);
  assert.match(booking, /setPhoneRevealed\(true\)/);
});

test("online booking is a three step pending approval flow without card collection", () => {
  assert.match(booking, /שלב 1 מתוך 3/);
  assert.match(booking, /שלב 2 מתוך 3/);
  assert.match(booking, /שלב 3 מתוך 3/);
  assert.match(booking, /אין הזנת כרטיס אשראי/);
  assert.match(booking, /הבקשה נשמרת בסטטוס ממתין/);
  assert.match(booking, /לא בוצע חיוב/);
  assert.doesNotMatch(booking, /cardNumber|expiry|cvv|cvc|מספר כרטיס/iu);
});

test("booking UI has responsive step, review, phone and safe mobile rules", () => {
  for (const selector of [".booking-steps", ".booking-form--steps", ".booking-review", ".phone-reveal", ".booking-unavailable"]) assert.match(css, new RegExp(selector.replace(".", "\\.")));
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.booking-flow--steps \{ grid-template-columns: 1fr/);
  assert.match(css, /safe-area-inset-bottom/);
});
