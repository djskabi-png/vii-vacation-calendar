import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");

test("vacation detail pages keep availability as the primary action", () => {
  assert.match(business, /activeWorld === "vacation"[^\n]+href="#booking-summary">בדיקת זמינות/);
  assert.match(business, /activeWorld === "vacation" \? "בדיקת זמינות"/);
  assert.doesNotMatch(business, /vacationPhoneFallback \? <aside id="booking-summary"/);
});

test("vacation availability starts with dates and only then offers an enquiry", () => {
  assert.match(business, /בדיקת זמינות במתחם/);
  assert.match(business, /בחירת תאריכים ובדיקת זמינות/);
  assert.match(business, /vacationRequest \? !hasSelectedDates/);
  assert.match(business, /שליחת בקשת זמינות בוואטסאפ/);
});

test("nearby recommendations explain their purpose in plain Hebrew", () => {
  assert.match(business, /רעיונות לבילוי ולטיול באזור מקום האירוח/);
  assert.doesNotMatch(business, /אימות התאמה, פרטים ואופן הזמנה/);
});