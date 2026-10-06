import assert from "node:assert/strict";
import { test } from "node:test";
import { liveSupplierSearch, validDate } from "../app/lib/vii-live-search.ts";

test("live vacation search keeps available, unavailable and unknown distinct", async () => {
  const calls = [];
  const result = await liveSupplierSearch({
    world: "vacations", from: "2026-10-10", till: "2026-10-12", guests: 4,
    token: "test-token", publishedIds: new Set([1, 2, 3]),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ created: "2026-10-06T10:00:00+03:00", sites: [
        { siteID: 1, available: true, onlineBooking: false, minTotal: 1200, cheapest: { from: "2026-10-10", till: "2026-10-12" } },
        { siteID: 2, available: false, minTotal: 1 },
        { siteID: 3, available: null, reason: "no_availability" },
        { siteID: 4, available: true, minTotal: 100 },
      ] });
    },
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].init.body), { from: "2026-10-10", nights: 2, rooms: [{ adults: 4 }] });
  assert.deepEqual(result.results.map(({ siteID, available, total }) => [siteID, available, total]), [[1, true, 1200], [2, false, null], [3, null, null]]);
  assert.equal(result.results[0].onlineBooking, false);
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
        { siteID: 11, available: false }, { siteID: 12, available: null, reason: "no_availability" }, { siteID: 13, available: true, minTotal: 900, cheapest: { date: "2026-10-11", endDate: "2026-10-11", start: "18:00" } },
      ] : [
        { siteID: 11, available: false }, { siteID: 12, available: false }, { siteID: 13, available: true, minTotal: 700, cheapest: { date: "2026-11-17", endDate: "2026-11-17", start: "19:00" } },
      ] });
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].window.till, "2026-11-09");
  assert.equal(calls[1].window.from, "2026-11-10");
  assert.deepEqual(result.results.map(({ siteID, available, total }) => [siteID, available, total]), [[11, false, null], [12, null, null], [13, true, 700]]);
});

test("invalid dates, duration and supplier failures fail closed", async () => {
  assert.equal(validDate("2026-02-30"), false);
  await assert.rejects(liveSupplierSearch({ world: "vacations", from: "2026-02-30", till: "2026-03-01", guests: 2, token: "x", publishedIds: new Set() }), /invalid_search/);
  await assert.rejects(liveSupplierSearch({ world: "events", from: "2026-10-10", till: "2026-10-10", guests: 2, hours: 0, token: "x", publishedIds: new Set() }), /invalid_search/);
  await assert.rejects(liveSupplierSearch({ world: "vacations", from: "2026-10-10", till: "2026-10-11", guests: 2, token: "x", publishedIds: new Set(), fetchImpl: async () => new Response(null, { status: 503 }) }), /supplier_unavailable/);
});
