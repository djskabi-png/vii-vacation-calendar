import assert from "node:assert/strict";
import test from "node:test";
import { cachedAvailabilityState, liveBookingEligibility } from "../app/lib/resolve-supplier-availability.ts";

const at = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const available = (checkedAt = at(1)) => ({ availability: "available", checkedAt, source: "supplier-calendar", from: "2026-11-17", till: "2026-11-18" });

test("fresh cache is display evidence but never booking authorization", () => {
  assert.deepEqual(cachedAvailabilityState(available(), Date.now()).state, "available");
  assert.equal(liveBookingEligibility(available(), false), false);
  assert.equal(liveBookingEligibility(available(), true), true);
});

test("stale, future-dated and unmanaged cache fail closed to unknown", () => {
  assert.equal(cachedAvailabilityState(available(at(10))).state, "unknown");
  assert.equal(cachedAvailabilityState(available(at(90))).state, "unknown");
  assert.equal(cachedAvailabilityState({ ...available(), source: "unmanaged" }).state, "unknown");
  assert.equal(liveBookingEligibility({ ...available(), source: "unmanaged" }, true), false);
});
