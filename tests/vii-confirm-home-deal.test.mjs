import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmHomeDeal } from "../app/lib/vii-confirm-home-deal.ts";

const base = { source: "home-deals", period: "tomorrow", siteID: 11, from: "2026-10-06", till: "2026-10-07", token: "test", publicSiteIds: new Set([11]), now: new Date("2026-10-05T12:00:00Z") };

function supplier(vacancy, roomID = 8) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/locations")) return Response.json({});
    if (url.endsWith("/vacations")) return Response.json({ places: [{ siteID: 11, active: true, siteName: "Real place", galleries: [{ pictures: ["/real.jpg"] }] }] });
    if (url.endsWith("/vacations/search")) return Response.json({ sites: [{ siteID: 11, available: true, minTotal: 800, cheapest: { from: base.from, till: base.till, rooms: roomID ? [{ roomID }] : [] } }] });
    assert.equal(url, "https://bizonline.co.il/api/ai/vii/vacations/11/vacancy");
    assert.deepEqual(JSON.parse(init.body), { siteID: 11, from: base.from, nights: 1, rooms: [{ roomID: 8, adults: 2 }] });
    return vacancy;
  };
  return { calls, fetchImpl };
}

test("detail confirms exact room, stay and total with read-only vacancy", async () => {
  const { calls, fetchImpl } = supplier(Response.json({ available: true, onlineBooking: true, summary: { siteID: 11, from: base.from, till: base.till, nights: 1, totals: { total: 920 } } }));
  assert.deepEqual(await confirmHomeDeal({ ...base, fetchImpl }), { status: "available", total: 920, onlineBooking: true });
  assert.equal(calls.length, 4);
});

test("unavailable and unsupported stays never display a verified price", async () => {
  assert.deepEqual(await confirmHomeDeal({ ...base, fetchImpl: supplier(Response.json({ available: false, reason: "not_available" })).fetchImpl }), { status: "unavailable" });
  assert.deepEqual(await confirmHomeDeal({ ...base, fetchImpl: supplier(new Response(null, { status: 409 })).fetchImpl }), { status: "unverified" });
  assert.deepEqual(await confirmHomeDeal({ ...base, fetchImpl: supplier(Response.json({ available: true, summary: { siteID: 11, from: base.from, till: base.till, nights: 1, totals: { total: 920 } } }), 0).fetchImpl }), { status: "unverified" });
});

test("invalid identity and stale selected dates cannot call vacancy", async () => {
  await assert.rejects(confirmHomeDeal({ ...base, siteID: 99, fetchImpl: async () => { throw Error("called"); } }), /invalid_stay/);
  const { calls, fetchImpl } = supplier(Response.json({ available: true }));
  assert.deepEqual(await confirmHomeDeal({ ...base, from: "2026-10-07", till: "2026-10-08", fetchImpl }), { status: "unavailable" });
  assert.equal(calls.some((call) => call.url.endsWith("/vacancy")), false);
});
