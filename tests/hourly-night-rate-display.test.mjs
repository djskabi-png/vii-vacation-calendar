import assert from "node:assert/strict";
import test from "node:test";
import { getHourlyDetails } from "../app/data/hourly-details.ts";

const item = {
  id: "hourly-2717",
  description: "חדרים לפי שעה וללילה",
  features: [],
};

function place(rates) {
  return {
    id: "hourly-2717",
    supplierId: 2717,
    name: "שדה נסתר",
    sourceUrl: "https://roomsvip.com/hidden-field",
    location: "פתח תקווה",
    area: "מרכז",
    description: "",
    images: [],
    phone: "",
    whatsapp: "",
    lat: null,
    lng: null,
    score: null,
    reviewCount: 0,
    rooms: [{
      id: 4576,
      name: "חדר נסתר",
      count: 1,
      maxGuests: 2,
      features: [],
      images: [],
      rates,
    }],
  };
}

test("hourly details render every normalized duration including the supplier night price", () => {
  const details = getHourlyDetails(item, place([
    { duration: "שעה", weekday: 250, weekend: 250 },
    { duration: "שעתיים", weekday: 250, weekend: 250 },
    { duration: "3 שעות", weekday: 300, weekend: 300 },
    { duration: "לילה", weekday: 550, weekend: 550 },
  ]));

  assert.equal(details.rates.length, 8);
  assert.deepEqual(details.rates.slice(-2), [
    { duration: "חדר נסתר · לילה · יום חול", price: "₪ 550" },
    { duration: "חדר נסתר · לילה · סוף שבוע", price: "₪ 550" },
  ]);
});

test("hourly details do not invent a night option when the supplier does not provide one", () => {
  const details = getHourlyDetails(item, place([
    { duration: "שעה", weekday: 250, weekend: 250 },
    { duration: "שעתיים", weekday: 250, weekend: 250 },
    { duration: "3 שעות", weekday: 300, weekend: 300 },
  ]));

  assert.equal(details.rates.some((rate) => rate.duration.includes("לילה")), false);
});
