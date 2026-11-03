import assert from "node:assert/strict";

const origin = process.env.VII_ORIGIN || "https://vii.spaplus.co";
const vacationPeriods = ["tomorrow", "weekend", "friday-weekend", "thursday", "friday"];
const request = async (path, init) => {
  const response = await fetch(`${origin}${path}`, init);
  const body = await response.json();
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  return body;
};

const report = { origin, checkedAt: new Date().toISOString(), vacations: {}, events: {} };

for (const period of vacationPeriods) {
  const body = await request(`/api/vii/home-deals?${new URLSearchParams({ period, locale: "he", proof: "verified-offers-v1" })}`);
  assert.equal(body.period, period, `${period}: wrong response period`);
  assert.equal(body.availabilityStatus, "verified", `${period}: unverified snapshot`);
  assert.ok(Array.isArray(body.deals), `${period}: missing deals`);
  assert.equal(new Set(body.deals.map(deal => deal.siteID)).size, body.deals.length, `${period}: duplicate identity`);
  assert.ok(body.deals.every(deal => deal.siteID > 0 && deal.from === body.dates.from && deal.till === body.dates.till
    && deal.total > 0 && deal.nights === body.dates.nights && deal.priceGuests > 0 && deal.image && deal.name), `${period}: incomplete deal`);
  const online = body.deals.map(deal => deal.onlineBooking === true && Number.isSafeInteger(deal.roomID) && deal.roomID > 0);
  const firstManual = online.indexOf(false);
  assert.ok(firstManual < 0 || online.slice(firstManual).every(value => !value), `${period}: online cohort is not first`);
  report.vacations[period] = { dates: body.dates, count: body.deals.length, siteIDs: body.deals.map(deal => deal.siteID) };
}

const eventDates = {
  lastminute: report.vacations.tomorrow.dates.from,
  thursday: report.vacations.thursday.dates.from,
  friday: report.vacations.friday.dates.from,
};
for (const [preset, date] of Object.entries(eventDates)) {
  const body = await request("/api/vii/live-search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ world: "events", from: date, till: date, guests: 20, includePlaces: true }),
  });
  assert.ok(Array.isArray(body.results) && Array.isArray(body.places), `${preset}: missing arrays`);
  const resultIds = body.results.map(offer => offer.siteID);
  const placeIds = body.places.map(place => Number(String(place.slug).replace(/^event-/, "")));
  assert.deepEqual(placeIds, resultIds, `${preset}: offer/place order mismatch`);
  assert.equal(new Set(resultIds).size, resultIds.length, `${preset}: duplicate identity`);
  assert.ok(body.results.every(offer => offer.available === true && offer.total > 0 && offer.from === date
    && ["morning", "evening"].includes(offer.slot) && Number.isSafeInteger(offer.roomID) && offer.roomID > 0), `${preset}: incomplete offer`);
  assert.ok(body.places.every(place => place.image && place.name), `${preset}: incomplete public place`);
  report.events[preset] = { date, count: resultIds.length, siteIDs: resultIds };
}

console.log(JSON.stringify(report, null, 2));
