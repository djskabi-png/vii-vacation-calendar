import assert from "node:assert/strict";
import { test } from "node:test";
import { supplierStayQuote } from "../app/lib/vii-stay-quote.ts";

const base = { siteID: 2662, from: "2026-10-15", till: "2026-10-16", guests: 2, token: "test", publishedIds: new Set([2662]) };

function supplier(searchSite, vacancy) {
  const calls = [];
  return { calls, fetchImpl: async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return Response.json(url.endsWith("/search") ? { sites: [searchSite] } : vacancy);
  } };
}

test("exact vacation quote confirms the selected supplier room and total", async () => {
  const { calls, fetchImpl } = supplier({ siteID: 2662, available: true, cheapest: { from: base.from, till: base.till, rooms: [{ roomID: 4487 }] } },
    { available: true, onlineBooking: true, summary: { siteID: 2662, from: base.from, till: base.till, nights: 1, totals: { total: 600 } } });
  assert.deepEqual(await supplierStayQuote({ ...base, fetchImpl }), { status: "available", total: 600, nights: 1, roomIDs: [4487], onlineBooking: true });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, { from: base.from, nights: 1, rooms: [{ adults: 2 }], siteID: 2662 });
  assert.deepEqual(calls[1].body, { siteID: 2662, from: base.from, nights: 1, rooms: [{ roomID: 4487, adults: 2 }] });
});

test("unavailable and malformed supplier responses never become prices", async () => {
  const unavailable = supplier({ siteID: 2662, available: false, reason: "no_prices" }, {});
  assert.deepEqual(await supplierStayQuote({ ...base, fetchImpl: unavailable.fetchImpl }), { status: "unavailable", reason: "no_prices" });
  assert.equal(unavailable.calls.length, 1);
  const wrongTotal = supplier({ siteID: 2662, available: true, cheapest: { from: base.from, till: base.till, rooms: [{ roomID: 4487 }] } },
    { available: true, summary: { siteID: 2662, from: base.from, till: base.till, nights: 1, totals: { total: 0 } } });
  assert.deepEqual(await supplierStayQuote({ ...base, fetchImpl: wrongTotal.fetchImpl }), { status: "unverified", reason: "invalid_supplier_response" });
  const multi = supplier({ siteID: 2662, available: true, cheapest: { from: base.from, till: base.till, rooms: [{ roomID: 1 }, { roomID: 2 }] } }, {});
  assert.deepEqual(await supplierStayQuote({ ...base, fetchImpl: multi.fetchImpl }), { status: "unverified", reason: "multiple_rooms" });
  assert.equal(multi.calls.length, 1);
});

test("unpublished site IDs cannot reach the supplier", async () => {
  await assert.rejects(supplierStayQuote({ ...base, siteID: 999, fetchImpl: async () => { throw Error("called"); } }), /invalid_stay/);
});
