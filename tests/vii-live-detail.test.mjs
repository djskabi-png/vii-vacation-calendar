import assert from "node:assert/strict";
import { test } from "node:test";
import { liveSupplierPlaceDetail, supplierPlaceDetail } from "../app/data/supplier-place-detail.ts";

test("a current supplier detail replaces stored photos, reviews, rooms and venue facts", async () => {
  const detail = await liveSupplierPlaceDetail("vacation-1", {
    token: "test-token",
    fetchImpl: async (url, init) => {
      assert.equal(init.headers.Authorization, "Bearer test-token");
      if (url.endsWith("/locations")) return Response.json({ cities: [{ id: 8, area: 3, title: "עיר חדשה" }], areas: [{ id: 3, title: "אזור חדש" }] });
      return Response.json({
        id: 1, active: true, name: "שם מעודכן", summary: "תיאור מעודכן", location: { city: 8 }, gps: { lat: 32.1, long: 35.1 },
        galleries: { main: { pictures: ["/gallery/new.jpg", "/gallery/second.jpg"] } },
        rooms: [{ roomName: "סוויטה חדשה", roomCount: 2, maxGuests: 4, bedrooms: 1, spaces: [{ features: [{ description: "בריכה" }] }] }],
        reviews: { count: 1, score: 9.5, list: [{ id: 123, author: "דנה", title: "מעולה", text: "מקום יפה", added: "2026-10-06", score: 9.5, pictures: [] }] },
        policy: { checkIn: "15:00:00", checkOut: "11:00:00" }, contact: { phone: "050-1234567" },
      });
    },
  });
  assert.equal(detail.name, "שם מעודכן");
  assert.equal(detail.location, "עיר חדשה");
  assert.equal(detail.area, "אזור חדש");
  assert.deepEqual(detail.images, ["https://www.vii.co.il/gallery/new.jpg", "https://www.vii.co.il/gallery/second.jpg"]);
  assert.equal(detail.reviewScore, 9.5);
  assert.equal(detail.reviews[0].text, "מקום יפה");
  assert.equal(detail.rooms[0].name, "סוויטה חדשה");
  assert.equal(detail.rooms[0].features[0], "בריכה");
});

test("supplier outage retains the last verified detail rather than fabricating a replacement", async () => {
  const detail = await liveSupplierPlaceDetail("vacation-1", { token: "test-token", fetchImpl: async () => new Response(null, { status: 503 }) });
  assert.deepEqual(detail, supplierPlaceDetail("vacation-1"));
});
