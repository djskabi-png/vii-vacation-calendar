import assert from "node:assert/strict";
import { test } from "node:test";
import { liveSupplierSearch, validDate } from "../app/lib/vii-live-search.ts";
import { vacationRoomsFromSearchParams } from "../app/lib/vacation-party.ts";

test("live vacation search keeps available, unavailable and unknown distinct", async () => {
  const calls = [];
  const result = await liveSupplierSearch({
    world: "vacations", from: "2026-10-10", till: "2026-10-12", guests: 4,
    token: "test-token", publishedIds: new Set([1, 2, 3]),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.endsWith("/vacations")) return Response.json({ places: [
        { siteID: 1, rooms: [{ roomID: 11, basisGuests: 2 }] },
      ] });
      return Response.json({ created: "2026-10-06T10:00:00+03:00", sites: [
        { siteID: 1, available: true, onlineBooking: false, minTotal: 1200, cheapest: { from: "2026-10-10", till: "2026-10-12", rooms: [{ slot: 0, roomID: 11, total: 1200 }] } },
        { siteID: 2, available: false, minTotal: 1 },
        { siteID: 3, available: null, reason: "no_availability" },
        { siteID: 4, available: true, minTotal: 100 },
      ] });
    },
  });
  assert.equal(calls.length, 2);
  const searchCall = calls.find((call) => call.url.endsWith("/vacations/search"));
  assert.deepEqual(JSON.parse(searchCall.init.body), { from: "2026-10-10", nights: 2, rooms: [{ adults: 4 }] });
  assert.deepEqual(result.results.map(({ siteID, available, total }) => [siteID, available, total]), [[1, true, 1200], [2, false, null], [3, null, null]]);
  assert.equal(result.results[0].onlineBooking, false);
  assert.equal(result.results[0].priceGuests, 2);
  assert.equal(result.results[0].priceMode, "stay_total");
});

test('infants are preserved separately and provider receives kids, never children',async()=>{
 const rooms=vacationRoomsFromSearchParams(new URLSearchParams('adults=2&children=1&infants=1&rooms=1'));
 assert.deepEqual(rooms,[{adults:2,children:1,infants:1}]);const calls=[];
 await liveSupplierSearch({world:'vacations',from:'2026-11-01',till:'2026-11-04',guests:3,rooms,token:'test',publishedIds:new Set(),fetchImpl:async(url,init)=>{if(init?.body)calls.push(JSON.parse(init.body));return Response.json(url.endsWith('/vacations')?{places:[]}:{sites:[]});}});
 assert.deepEqual(calls[0].rooms,[{adults:2,kids:1,infants:1}]);
});

test("multi-room vacation search preserves room composition and marks the price as a nightly average", async () => {
  const calls = [];
  const result = await liveSupplierSearch({
    world: "vacations", from: "2026-11-01", till: "2026-11-04", guests: 7,
    rooms: [{ adults: 2, children: 1 }, { adults: 3, children: 1 }],
    token: "test-token", publishedIds: new Set([8]),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.endsWith("/vacations")) return Response.json({ places: [{ siteID: 8, rooms: [{ roomID: 81, basisGuests: 2 }, { roomID: 82, basisGuests: 4 }] }] });
      return Response.json({ sites: [{ siteID: 8, available: true, minTotal: 4500, cheapest: { from: "2026-11-01", till: "2026-11-04", rooms: [{ slot: 0, roomID: 81, total: 1800 }, { slot: 1, roomID: 82, total: 2700 }] } }] });
    },
  });
  const searchCall = calls.find((call) => call.url.endsWith("/vacations/search"));
  assert.deepEqual(JSON.parse(searchCall.init.body), { from: "2026-11-01", nights: 3, rooms: [{ adults: 2, kids: 1 }, { adults: 3, kids: 1 }] });
  assert.equal(result.results[0].total, 4500);
  assert.equal(result.results[0].priceGuests, 6);
  assert.equal(result.results[0].roomCount, 2);
  assert.equal(result.results[0].priceMode, "nightly_average");
});

test("flexible vacation search sends one provider window and keeps only an allowed candidate stay", async () => {
  const calls = [];
  const candidates = [
    { from: "2026-11-05", till: "2026-11-08" },
    { from: "2026-11-12", till: "2026-11-15" },
  ];
  const result = await liveSupplierSearch({
    world: "vacations", from: "2026-11-05", till: "2026-11-15", guests: 2, candidates,
    token: "test-token", publishedIds: new Set([11, 12]),
    fetchImpl: async (url, init = {}) => {
      if (url.endsWith("/vacations")) return Response.json({ places: [] });
      calls.push(JSON.parse(init.body));
      return Response.json({ sites: [
        { siteID: 11, available: true, onlineBooking: true, minTotal: 1800, cheapest: { from: "2026-11-06", till: "2026-11-09", total: 1800 }, alternatives: [{ from: "2026-11-05", till: "2026-11-08", total: 2100 }] },
        { siteID: 12, available: true, onlineBooking: true, minTotal: 1700, cheapest: { from: "2026-11-06", till: "2026-11-09", total: 1700 } },
      ] });
    },
  });
  assert.deepEqual(calls, [{ window: { from: "2026-11-05", till: "2026-11-15" }, nights: 3, rooms: [{ adults: 2 }] }]);
  assert.deepEqual(result.results.map(({ siteID, available, total, from, till }) => [siteID, available, total, from, till]), [
    [11, true, 2100, "2026-11-05", "2026-11-08"],
    [12, null, null, null, null],
  ]);
});

test("event search splits a 60-day window and never treats a partial unknown as unavailable", async () => {
  const calls = [];
  const result = await liveSupplierSearch({
    world: "events", from: "2026-10-10", till: "2026-12-09", guests: 20, hours: 3,
    token: "test-token", publishedIds: new Set([11, 12, 13]),
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      const first = body.window.from === "2026-10-10";
      return Response.json({ sites: first ? [
        { siteID: 11, available: false }, { siteID: 12, available: null, reason: "no_availability" }, { siteID: 13, available: true, minPrice: 900, cheapest: { date: "2026-10-11", slot: "morning", roomID: 130, price: 900 } },
      ] : [
        { siteID: 11, available: false }, { siteID: 12, available: false }, { siteID: 13, available: true, minPrice: 700, cheapest: { date: "2026-11-17", slot: "evening", roomID: 130, price: 700 } },
      ] });
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].window.till, "2026-11-09");
  assert.equal(calls[1].window.from, "2026-11-10");
  assert.equal(calls[0].guests, 20);
  assert.equal(calls[0].hours, undefined);
  assert.equal(calls[0].rooms, undefined);
  assert.deepEqual(result.results.map(({ siteID, available, total }) => [siteID, available, total]), [[11, false, null], [12, null, null], [13, true, 700]]);
});

test("invalid dates, duration and supplier failures fail closed", async () => {
  assert.equal(validDate("2026-02-30"), false);
  await assert.rejects(liveSupplierSearch({ world: "vacations", from: "2026-02-30", till: "2026-03-01", guests: 2, token: "x", publishedIds: new Set() }), /invalid_search/);
  await assert.rejects(liveSupplierSearch({ world: "events", from: "2026-10-10", till: "2026-10-10", guests: 2, slot: "afternoon", token: "x", publishedIds: new Set() }), /invalid_search/);
  await assert.rejects(liveSupplierSearch({ world: "vacations", from: "2026-10-10", till: "2026-10-11", guests: 2, token: "x", publishedIds: new Set(), fetchImpl: async (url) => url.endsWith("/vacations") ? Response.json({ places: [] }) : new Response(null, { status: 503 }) }), /supplier_unavailable/);
});
