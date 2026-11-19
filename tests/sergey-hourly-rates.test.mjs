import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSergeyHourlyRates } from "../app/lib/sergey-hourly-rates.ts";

test("normalizes paired weekday and weekend overnight prices after hourly durations", () => {
  const rates = normalizeSergeyHourlyRates({
    hourPriceWeekday: 250,
    hourPriceWeekend: 270,
    overnightPriceWeekday: 550,
    overnightPriceWeekend: 650,
  });
  assert.deepEqual(rates, [
    { duration: "שעה", weekday: 250, weekend: 270 },
    { duration: "לילה", weekday: 550, weekend: 650 },
  ]);
});

test("uses one exact scalar night price for both day groups", () => {
  assert.deepEqual(normalizeSergeyHourlyRates({ nightPrice: "550" }).at(-1), {
    duration: "לילה",
    weekday: 550,
    weekend: 550,
  });
  assert.deepEqual(normalizeSergeyHourlyRates({ pricePerNight: 620 }).at(-1), {
    duration: "לילה",
    weekday: 620,
    weekend: 620,
  });
});

test("accepts an exact room-level overnight projection when basePrices omits it", () => {
  const rates = normalizeSergeyHourlyRates(
    { hourPriceWeekday: 250, hourPriceWeekend: 250 },
    { overnightWeekdayPrice: 550, overnightWeekendPrice: 600 },
  );
  assert.deepEqual(rates.at(-1), { duration: "לילה", weekday: 550, weekend: 600 });
});

test("maps the documented supplier weekday1 and weekend1 fields to the night rate", () => {
  assert.deepEqual(normalizeSergeyHourlyRates({
    hourPriceWeekday: 250,
    hourPriceWeekend: 250,
    weekday1: 550,
    weekend1: 650,
  }), [
    { duration: "שעה", weekday: 250, weekend: 250 },
    { duration: "לילה", weekday: 550, weekend: 650 },
  ]);
});

test("accepts documented night aliases from the room projection", () => {
  assert.deepEqual(normalizeSergeyHourlyRates({}, {
    weekday1: "560",
    weekend1: "710",
  }), [
    { duration: "לילה", weekday: 560, weekend: 710 },
  ]);
});

test("never invents an overnight price from missing, zero, malformed or unrelated fields", () => {
  for (const value of [
    {},
    { nightPrice: 0 },
    { nightPrice: "550.50" },
    { weekday1: 0, weekend1: -700 },
    { weekday1: "550.50", weekend1: "not-a-price" },
    { nightlyMinimumStay: 550 },
    { nightPrice: -550 },
  ]) {
    assert.equal(normalizeSergeyHourlyRates(value).some((rate) => rate.duration === "לילה"), false);
  }
});

test("paired values take precedence over a scalar fallback independently", () => {
  assert.deepEqual(normalizeSergeyHourlyRates({
    nightPrice: 550,
    nightPriceWeekend: 700,
  }), [{ duration: "לילה", weekday: 550, weekend: 700 }]);
});
