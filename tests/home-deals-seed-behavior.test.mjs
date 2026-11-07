import test from "node:test";
import assert from "node:assert/strict";
import { acceptedHomeDealsSeed } from "../app/lib/home-deals-seed.ts";

const base = { availabilityStatus: "verified", period: "tomorrow", guests: 2, locale: "he", region: null, clockKey: "2026-11-07T00", dates: { from: "2026-11-07", till: "2026-11-08" }, cache: { checkedAt: "2026-11-07T10:00:00.000Z", status: "fresh" }, deals: [{ priceGuests: 2, from: "2026-11-07", till: "2026-11-08" }] };
const expected = { period: "tomorrow", guests: 2, locale: "he", region: null, clockKey: "2026-11-07T00", from: "2026-11-07", till: "2026-11-08", now: Date.parse("2026-11-07T10:04:00Z") };

test("accepts exact SSR seed and rejects context drift", () => {
  assert.equal(acceptedHomeDealsSeed(base, expected), true);
  assert.equal(acceptedHomeDealsSeed(base, { ...expected, guests: 4 }), false);
  assert.equal(acceptedHomeDealsSeed(base, { ...expected, locale: "en" }), false);
  assert.equal(acceptedHomeDealsSeed(base, { ...expected, clockKey: "2026-11-07T01" }), false);
  assert.equal(acceptedHomeDealsSeed(base, { ...expected, from: "2026-11-08" }), false);
});

test("rejects expired or unavailable seed", () => {
  assert.equal(acceptedHomeDealsSeed({ ...base, availabilityStatus: "refreshing" }, expected), false);
  assert.equal(acceptedHomeDealsSeed(base, { ...expected, now: Date.parse("2026-11-07T11:01:00Z") }), false);
});
