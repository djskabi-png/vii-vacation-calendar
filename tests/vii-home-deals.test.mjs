import assert from "node:assert/strict";
import { test } from "node:test";
import { getHomeDeals, homeDealDates } from "../app/lib/vii-home-deals.ts";

test("home deal periods follow Israel dates and the upcoming weekend", () => {
  const monday = new Date("2026-10-05T12:00:00Z");
  assert.deepEqual(homeDealDates("tomorrow", monday), { from: "2026-10-06", till: "2026-10-07", nights: 1 });
  assert.deepEqual(homeDealDates("weekend", monday), { from: "2026-10-08", till: "2026-10-10", nights: 2 });
  assert.deepEqual(homeDealDates("friday-weekend", monday), { from: "2026-10-09", till: "2026-10-11", nights: 2 });
  assert.deepEqual(homeDealDates("tomorrow", new Date("2026-10-05T22:00:00Z")), { from: "2026-10-07", till: "2026-10-08", nights: 1 });
});

test("home deals use only supplier-confirmed availability and live totals", async () => {
  const requested = [];
  const fetchImpl = async (url, init) => {
    assert.equal(init.headers.Authorization, "Bearer test-token");
    requested.push({ url, init });
    if (url.endsWith("/locations")) return Response.json({ areas: [{ id: 2, title: "כנרת" }], cities: [{ id: 3, area: 2, title: "כלנית" }] });
    if (url.endsWith("/vacations")) return Response.json({ places: [
      { siteID: 11, active: true, siteName: "הילת הנוף", location: { cityID: 3 }, reviews: { score: 9.8, count: 182 }, galleries: [{ pictures: ["/gallery/hilat.jpg"] }] },
      { siteID: 12, active: true, siteName: "לא פנוי", galleries: [{ pictures: ["/gallery/other.jpg"] }] },
      { siteID: 13, active: true, siteName: "מחוץ לאתר", galleries: [{ pictures: ["/gallery/third.jpg"] }] },
    ] });
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), { from: "2026-10-06", nights: 1, rooms: [{ adults: 2 }] });
    return Response.json({ created: "2026-10-05T20:00:00+03:00", sites: [
      { siteID: 11, available: true, minTotal: 850, cheapest: { from: "2026-10-06", till: "2026-10-07" } },
      { siteID: 12, available: false, minTotal: 700 },
      { siteID: 13, available: true, minTotal: 900, cheapest: { from: "2026-10-06", till: "2026-10-07" } },
    ] });
  };
  const result = await getHomeDeals({ period: "tomorrow", now: new Date("2026-10-05T12:00:00Z"), token: "test-token", publicSiteIds: new Set([11, 12]), fetchImpl });
  assert.equal(result.period, "tomorrow");
  assert.equal(requested.length, 3);
  assert.deepEqual(result.deals, [{ siteID: 11, name: "הילת הנוף", image: "https://www.vii.co.il/gallery/hilat.jpg", city: "כלנית", area: "כנרת", score: 9.9, reviewCount: 182, from: "2026-10-06", till: "2026-10-07", total: 850, nights: 1 }]);
});

test("catalog placeholder ratings never override real site reviews", async () => {
  const fetchImpl = async (url) => url.endsWith("/locations") ? Response.json({}) : url.endsWith("/vacations")
    ? Response.json({ places: [{ siteID: 2662, active: true, siteName: "נעם בגלבוע", reviews: { score: 10, count: 10 }, galleries: [{ pictures: ["/gallery/a.jpg"] }] }] })
    : Response.json({ sites: [{ siteID: 2662, available: true, minTotal: 900, cheapest: { from: "2026-10-06", till: "2026-10-07" } }] });
  const result = await getHomeDeals({ period: "tomorrow", now: new Date("2026-10-05T12:00:00Z"), token: "test-token", publicSiteIds: new Set([2662]), fetchImpl });
  assert.equal(result.deals[0].reviewCount, 0);
  assert.equal(result.deals[0].score, null);
});

test("a locations outage does not hide valid supplier deals", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/locations")) return new Response(null, { status: 503 });
    if (url.endsWith("/vacations")) return Response.json({ places: [{ siteID: 11, active: true, siteName: "הילת הנוף", reviews: { score: 11, count: -1 }, galleries: [{ pictures: ["/gallery/hilat.jpg"] }] }] });
    return Response.json({ sites: [{ siteID: 11, available: true, minTotal: 850, cheapest: { from: "2026-10-06", till: "2026-10-07" } }] });
  };
  const result = await getHomeDeals({ period: "tomorrow", now: new Date("2026-10-05T12:00:00Z"), token: "test-token", publicSiteIds: new Set([11]), fetchImpl });
  assert.equal(result.deals.length, 1);
  assert.equal(result.deals[0].score, 9.9);
  assert.equal(result.deals[0].reviewCount, 182);
  assert.equal(result.deals[0].city, "");
});

test("supplier failure is not replaced with invented deals", async () => {
  await assert.rejects(getHomeDeals({ period: "tomorrow", token: "", publicSiteIds: new Set() }), /missing_token/);
  await assert.rejects(getHomeDeals({ period: "tomorrow", token: "test-token", publicSiteIds: new Set(), fetchImpl: async () => new Response(null, { status: 503 }) }), /supplier_unavailable/);
});
