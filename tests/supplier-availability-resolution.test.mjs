import assert from "node:assert/strict";
import test from "node:test";
import { resolveSupplierAvailability } from "../app/lib/resolve-supplier-availability.ts";

const base = { from: "2026-11-19", till: "2026-11-21", showSelectedDates: true };
const calendar = { allowed: true, minimumNights: 2 };

test("calendar confirms occupancy when quote has no explicit refusal", () => {
  const result = resolveSupplierAvailability({ ...base, availability: "unavailable", unavailableReason: undefined }, calendar, base.from, base.till);
  assert.equal(result?.availability, "available");
  assert.equal(result?.nightlyPrice, undefined);
  assert.equal(result?.minimumNights, 2);
});

test("explicit supplier restrictions remain blocked despite a positive calendar", () => {
  for (const reason of ["not_available", "min_nights", "closed_to_arrival", "capacity"]) {
    const quote = { ...base, availability: "unavailable", unavailableReason: reason };
    assert.equal(resolveSupplierAvailability(quote, calendar, base.from, base.till)?.unavailableReason, reason);
  }
});

test("priced quote wins and unknown calendar does not manufacture availability", () => {
  const priced = { ...base, availability: "available", nightlyPrice: 450 };
  assert.equal(resolveSupplierAvailability(priced, calendar, base.from, base.till)?.nightlyPrice, 450);
  const unknown = { ...base, availability: "unknown" };
  assert.equal(resolveSupplierAvailability(unknown, { allowed: false }, base.from, base.till)?.availability, "unknown");
});
