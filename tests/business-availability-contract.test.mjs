import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const vacationHub = readFileSync(new URL("../app/components/vacation-booking-hub.tsx", import.meta.url), "utf8");
const propertyCard = readFileSync(new URL("../app/components/property-card.tsx", import.meta.url), "utf8");

test("search cards and business details share the same seven-state availability resolver", () => {
  assert.match(propertyCard, /export function resolveAvailabilityForStay/);
  assert.match(propertyCard, /property\.dailyAvailability\?\.length/);
  assert.match(propertyCard, /selectedDays\.every\(\(day\) => day\.availableUnits > 0\)/);
  assert.match(propertyCard, /liveLegacyAvailability\.quote \|\| resolveAvailabilityForStay/);
  assert.match(business, /resolveAvailabilityForStay\(property, selectedStay/);
  for (const state of ["available-price", "price-only", "available-no-price", "no-data", "unavailable", "unavailable-alternatives", "unavailable-price"]) assert.match(vacationHub, new RegExp(state));
  assert.match(business, /resolvedAvailability\?\.availability === "available"/);
});

test("vacation detail keeps one contextual booking action", () => {
  assert.match(business, /activeWorld === "vacation" \? null : onlineBooking/);
  assert.match(business, /onlineHref={activeWorld === "vacation" \? undefined/);
  assert.doesNotMatch(business, /בדיקת זמינות לחיפוש הזה/);
  assert.match(business, /<VacationBookingHub/);
  assert.match(vacationHub, />הזמנה מהירה<\/Link>/);
});

test("vacation availability starts with dates and only then offers an enquiry", () => {
  assert.match(vacationHub, /state === "choose-dates"/);
  assert.match(vacationHub, /בחרו תאריכים כדי לראות זמינות ומחיר/);
  assert.match(vacationHub, /unavailable \|\| !hasDates/);
  assert.match(vacationHub, /"בחירת תאריכים"/);
  assert.match(vacationHub, /buttonLabel="בדיקת זמינות"/);
  assert.match(vacationHub, /availability\.availability === "available"/);
});

test("nearby recommendations explain their purpose in plain Hebrew", () => {
  assert.match(business, /רעיונות לבילוי ולטיול באזור מקום האירוח/);
  assert.doesNotMatch(business, /אימות התאמה, פרטים ואופן הזמנה/);
});
