import assert from "node:assert/strict";
import { test } from "node:test";
import { getHomeDeals, homeDealDates } from "../app/lib/vii-home-deals.ts";

test("discovery enriches live search from accepted catalog without broken supplier list or location calls", async () => {
  let calls = 0;
  const result = await getHomeDeals({ period: "tomorrow", now: new Date("2026-10-05T12:00:00Z"), token: "test", publicSiteIds: new Set([11, 12]),
    fetchImpl: async (url) => { calls++; assert.ok(url.endsWith("/vacations/search")); return Response.json({ sites: [
      { siteID: 11, available: true, minTotal: 900, onlineBooking: true, cheapest: { from: "2026-10-06", till: "2026-10-07", rooms: [{ roomID: 7 }] } },
      { siteID: 12, available: false, minTotal: 1 },
    ] }); },
    resolveCatalog: async ids => { assert.deepEqual(ids, [11]); return new Map([[11, { name: "Accepted", images: ["https://www.vii.co.il/gallery/real.jpg"], city: "City", area: "Area", rooms: [{ roomID: 7, roomName: "Suite", bedrooms: 1, maxGuests: 2 }] }]]); },
  });
  assert.equal(calls, 1); assert.equal(result.deals.length, 1);
  assert.equal(result.deals[0].total, 900); assert.equal(result.deals[0].roomName, "Suite"); assert.equal(result.deals[0].city, "City");
});

test("supplier availability cannot reintroduce an internal fixture into a fresh homepage snapshot", async () => {
  const result = await getHomeDeals({ period: "tomorrow", now: new Date("2026-10-05T12:00:00Z"), token: "test", publicSiteIds: new Set([11]),
    fetchImpl: async () => Response.json({ sites: [
      { siteID: 11, available: true, minTotal: 100, onlineBooking: true, cheapest: { from: "2026-10-06", till: "2026-10-07", rooms: [{ roomID: 4 }] } },
    ] }),
    resolveCatalog: async () => new Map([[11, { name: "המתחם הקטלני של רועי", images: ["https://www.vii.co.il/gallery/test.jpg"], city: "ראשון לציון", area: "מישור החוף והשפלה", rooms: [{ roomID: 4, roomName: "test4", bedrooms: 1, maxGuests: 4 }], phone: "050-1234567" }]]),
  });
  assert.deepEqual(result.deals, []);
});

test("canonical metadata never substitutes base prices for a failed search", async () => {
  await assert.rejects(getHomeDeals({ period: "tomorrow", token: "test", publicSiteIds: new Set([11]), resolveCatalog: async () => new Map(), fetchImpl: async () => Response.json({ error: "supplier SQL error" }) }), /invalid_supplier_response/);
});

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
      { siteID: 11, available: true, onlineBooking: false, minTotal: 850, cheapest: { from: "2026-10-06", till: "2026-10-07" } },
      { siteID: 12, available: false, minTotal: 700 },
      { siteID: 13, available: true, minTotal: 900, cheapest: { from: "2026-10-06", till: "2026-10-07" } },
    ] });
  };
  const result = await getHomeDeals({ period: "tomorrow", now: new Date("2026-10-05T12:00:00Z"), token: "test-token", publicSiteIds: new Set([11, 12]), publicNames: new Map([[11, "שם עמוד המקום"]]), fetchImpl });
  assert.equal(result.period, "tomorrow");
  assert.equal(requested.length, 3);
  assert.deepEqual(result.deals, [{ siteID: 11, name: "שם עמוד המקום", image: "/api/vii/media/hilat.jpg", images: ["/api/vii/media/hilat.jpg"], city: "כלנית", area: "כנרת", score: 9.9, reviewCount: 182, from: "2026-10-06", till: "2026-10-07", total: 850, nights: 1, priceGuests: 2, onlineBooking: false }]);
});

test("home deals expose only verified room facts, guest basis and safe supplier phone", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/locations")) return Response.json({});
    if (url.endsWith("/vacations")) return Response.json({ places: [{ siteID: 11, active: true, siteName: "מקום", galleries: [{ pictures: ["/gallery/place.jpg"] }],
      rooms: [{ roomID: 77, roomName: "וילה פרטית", bedrooms: 4, maxGuests: 12 }], contact: { phone: "050-1234567" } }] });
    return Response.json({ sites: [{ siteID: 11, available: true, minTotal: 1800, cheapest: { from: "2026-10-06", till: "2026-10-07", rooms: [{ roomID: 77 }] } }] });
  };
  const result = await getHomeDeals({ period: "tomorrow", now: new Date("2026-10-05T12:00:00Z"), token: "test-token", publicSiteIds: new Set([11]), fetchImpl });
  assert.deepEqual({ roomName: result.deals[0].roomName, bedrooms: result.deals[0].bedrooms, maxGuests: result.deals[0].maxGuests, phone: result.deals[0].phone, priceGuests: result.deals[0].priceGuests },
    { roomName: "וילה פרטית", bedrooms: 4, maxGuests: 12, phone: "050-1234567", priceGuests: 2 });
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

test("deal cards preserve verified gallery photos from every gallery without extra reads", async () => {
  let reads = 0;
  const fetchImpl = async (url) => {
    reads++;
    if (url.endsWith("/locations")) return Response.json({});
    if (url.endsWith("/vacations")) return Response.json({ places: [{ siteID: 11, active: true, siteName: "מקום", galleries: [
      { pictures: ["/gallery/cover.jpg", "/gallery/pool.jpg", "http://www.vii.co.il/unsafe.jpg", "https://evil.example/wrong.jpg"] },
      { pictures: ["/gallery/pool.jpg", "/gallery/room.jpg", null, ...Array.from({ length: 20 }, (_, i) => `/gallery/${i}.jpg`)] },
      { pictures: null }, null,
    ] }] });
    return Response.json({ sites: [{ siteID: 11, available: true, minTotal: 850, cheapest: { from: "2026-10-06", till: "2026-10-07" } }] });
  };
  const result = await getHomeDeals({ period: "tomorrow", now: new Date("2026-10-05T12:00:00Z"), token: "test-token", publicSiteIds: new Set([11]), fetchImpl });
  const deal = result.deals[0];
  assert.equal(reads, 3);
  assert.equal(deal.images.length, 10);
  assert.equal(new Set(deal.images).size, deal.images.length);
  assert.equal(deal.image, deal.images[0]);
  assert.deepEqual(deal.images.slice(0, 3), ["cover", "pool", "room"].map(name => `/api/vii/media/${name}.jpg`));
  assert.ok(deal.images.every(url => url.startsWith("/api/vii/media/")));
});
