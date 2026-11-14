import test from "node:test";
import assert from "node:assert/strict";
import { liveSupplierSearch } from "../app/lib/vii-live-search.ts";
import { loadEventDiscovery, eventDiscoveryKey, eventDiscoveryValidator, eventOffersForSlot, EVENT_DISCOVERY_POLICY } from "../app/lib/event-discovery-offers.ts";
import { uniqueEventVenueItems, eventDiscoveryResponseMatches, EVENT_DISCOVERY_VERSION } from "../app/lib/event-discovery-contract.ts";

const date = "2026-11-05";
const cell = (freeUnits, extra = {}) => ({ available: false, freeUnits, roomID: null, price: null, ...extra });
const day = (morning, evening = cell(0)) => ({ date, morning, evening });
const venue = (siteID, days, extra = {}) => ({ siteID, available: null, onlineBooking: true, reason: "no_prices", minPrice: null, cheapest: null, days, ...extra });
const search = (sites, extra = {}) => liveSupplierSearch({ world: "events", from: date, till: date, guests: 20,
  token: "test", publishedIds: new Set(sites.map(s => s.siteID)), includeEventSlots: true,
  fetchImpl: async () => Response.json({ sites }), ...extra });

test("no_prices retains positive free units without pretending to know a free room or price", async () => {
  const result = await search([venue(2, [day(cell(2))])]);
  assert.equal(result.results[0].available, true);
  assert.equal(result.results[0].total, null);
  assert.equal(result.results[0].roomID, undefined);
  assert.equal(result.results[0].onlineBooking, false);
  assert.equal(result.results[0].freeUnits, 2);
  assert.equal(result.results[0].availabilitySource, "supplier_days");
});

test("an occupied room advertising floor cannot price a different free unpriced room", async () => {
  const result = await search([venue(2, [day(cell(2, { roomID: 40, price: 3500 }))])]);
  assert.equal(result.results[0].available, true);
  assert.equal(result.results[0].total, null);
  assert.equal(result.results[0].roomID, undefined);
});

test("both slots survive bulk acquisition; local selection can recover the unpriced morning", async () => {
  const result = await search([venue(2, [day(cell(2), cell(1, { available: true, roomID: 40, price: 5500 }))])]);
  assert.equal(result.results[0].total, 5500);
  assert.equal(result.results[0].slot, "evening");
  assert.equal(result.eventSlots.length, 2);
  assert.equal(eventOffersForSlot(result.eventSlots, "morning")[0].total, null);
  assert.equal(eventOffersForSlot(result.eventSlots, "evening")[0].roomID, 40);
});

test("occupied calendar overrides a contradictory cheapest quote", async () => {
  const result = await search([venue(2, [day(cell(0))], { available: true, minPrice: 3500, cheapest: { date, slot: "morning", roomID: 40, price: 3500 } })]);
  assert.equal(result.results[0].available, false);
  assert.equal(result.eventSlots.length, 0);
});

for (const freeUnits of [null, undefined, -1, 0.5, "2"]) {
  test(`malformed or unknown freeUnits ${freeUnits} never establishes availability`, async () => {
    const result = await search([venue(2, [day(cell(freeUnits), cell(null))])]);
    assert.equal(result.results[0].available, null);
  });
}

test("no_availability and not_events cannot become available even with conflicting positive counts", async () => {
  const result = await search([venue(2, [day(cell(2))], { reason: "no_availability" }), venue(3, [day(cell(2))], { reason: "not_events" })]);
  assert.deepEqual(result.results.map(r => r.available), [null, false]);
});

test("selected slot and exact date exclude unrelated inventory", async () => {
  const result = await search([venue(2, [day(cell(0), cell(2))]), venue(3, [{ ...day(cell(2)), date: "2026-11-06" }])], { slot: "morning" });
  assert.deepEqual(result.results.map(r => r.available), [false, null]);
});

test("duplicate day identities are quarantined instead of choosing an arbitrary inventory value", async () => {
  const result = await search([venue(2, [day(cell(2)), day(cell(0))])]);
  assert.equal(result.results[0].available, null);
});

test("complete event data is not limited to an editorial twenty-card rail", async () => {
  const result = await search(Array.from({ length: 35 }, (_, i) => venue(i + 1, [day(cell(2))])));
  assert.equal(eventOffersForSlot(result.eventSlots).length, 35);
  assert.equal(uniqueEventVenueItems([...result.results, result.results[0]], r => r.siteID).length, 35);
});

test("one versioned bulk snapshot owns both slots for one exact party and date", async () => {
  const calls = [];
  const snapshot = await loadEventDiscovery({ date, guests: 100, token: "test", publishedIds: new Set([2]),
    fetchImpl: async (_url, init) => { calls.push(JSON.parse(init.body)); return Response.json({ sites: [venue(2, [day(cell(1), cell(2))])] }); } });
  assert.deepEqual(calls, [{ date, guests: 100 }]);
  assert.equal(snapshot.eventSlots.length, 2);
  assert.equal(eventDiscoveryValidator(date, 100)(snapshot), true);
  assert.equal(eventDiscoveryValidator(date, 20)(snapshot), false);
  assert.equal(eventDiscoveryValidator("2026-11-06", 100)(snapshot), false);
  assert.equal(eventDiscoveryValidator(date, 100)({ results: snapshot.results }), false);
  assert.notDeepEqual(eventDiscoveryKey(date, 20), eventDiscoveryKey(date, 100));
  assert.ok(EVENT_DISCOVERY_POLICY.staleMs <= 60 * 60_000);
});

test("browser cache rejects old generation, wrong scope and expired source evidence", () => {
  const now = Date.parse(`${date}T10:00:00Z`);
  const response = { discoveryVersion: EVENT_DISCOVERY_VERSION, scope: {date, guests:20}, results: [], places: [], cache: {checkedAt:new Date(now).toISOString()} };
  assert.equal(eventDiscoveryResponseMatches(response, date, 20, undefined, now), true);
  assert.equal(eventDiscoveryResponseMatches({...response, region:null}, date, 20, undefined, now), true, "JSON null is the same unscoped region as browser undefined");
  assert.equal(eventDiscoveryResponseMatches({...response, discoveryVersion:1}, date, 20, undefined, now), false);
  assert.equal(eventDiscoveryResponseMatches(response, date, 100, undefined, now), false);
  assert.equal(eventDiscoveryResponseMatches(response, date, 20, "צפון", now), false);
  assert.equal(eventDiscoveryResponseMatches(response, date, 20, undefined, now + 60 * 60_000 + 1), false);
});
