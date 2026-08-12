import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");

test("vacation detail keeps one contextual booking action", () => {
  assert.match(business, /activeWorld === "vacation" \? null : onlineBooking/);
  assert.match(business, /onlineHref={activeWorld === "vacation" \? undefined/);
  assert.doesNotMatch(business, /בדיקת זמינות לחיפוש הזה/);
  assert.match(business, />הזמנה מהירה<\/Link>/);
});

test("vacation availability starts with dates and only then offers an enquiry", () => {
  assert.match(business, /בדיקת זמינות במתחם/);
  assert.match(business, /בודקים את החופשה שבחרתם/);
  assert.match(business, /התאריכים והרכב האורחים נשמרו מהחיפוש/);
  assert.match(business, /בחירת תאריכים ובדיקת זמינות/);
  assert.match(business, /vacationRequest \? !hasSelectedDates/);
  assert.match(business, /שליחת בקשת זמינות בוואטסאפ/);
});

test("nearby recommendations explain their purpose in plain Hebrew", () => {
  assert.match(business, /רעיונות לבילוי ולטיול באזור מקום האירוח/);
  assert.doesNotMatch(business, /אימות התאמה, פרטים ואופן הזמנה/);
});
