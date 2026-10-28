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
        rooms: [{ roomName: "סוויטה חדשה", roomCount: 2, maxGuests: 4, basisGuests: 2, bedrooms: 1, roomSize: 45, totalSize: 1500, spaces: [{ features: [{ description: "בריכה" }] }] }],
        reviews: { count: 1, score: 9.5, list: [{ id: 123, author: "דנה", title: "מעולה", text: "מקום יפה", added: "2026-10-06", score: 9.5, pictures: [] }] },
        policy: { checkIn: "15:00:00", checkOut: "11:00:00" }, contact: { phone: "050-1234567", whatsapp: "054-7654321" },
      });
    },
  });
  assert.equal(detail.name, "שם מעודכן");
  assert.equal(detail.location, "עיר חדשה");
  assert.equal(detail.area, "אזור חדש");
  assert.deepEqual(detail.images, ["/api/vii/media/new.jpg", "/api/vii/media/second.jpg"]);
  assert.equal(detail.reviewScore, 9.5);
  assert.equal(detail.reviews[0].text, "מקום יפה");
  assert.equal(detail.rooms[0].name, "סוויטה חדשה");
  assert.equal(detail.rooms[0].features[0], "בריכה");
  assert.equal(detail.rooms[0].builtArea, 45);
  assert.equal(detail.rooms[0].totalArea, 1500);
  assert.equal(detail.rooms[0].area, 45);
  assert.equal(detail.rooms[0].basisGuests, 2);
  assert.equal(detail.phone, "050-1234567");
  assert.equal(detail.whatsapp, "054-7654321");
});

test("supplier outage retains the last verified detail rather than fabricating a replacement", async () => {
  const detail = await liveSupplierPlaceDetail("vacation-1", { token: "test-token", fetchImpl: async () => new Response(null, { status: 503 }) });
  assert.deepEqual(detail, supplierPlaceDetail("vacation-1"));
});

test("live room detail keeps supplier ordering and matches the verified room gallery", async () => {
  const detail = await liveSupplierPlaceDetail("vacation-41", {
    token: "test-token",
    fetchImpl: async (url) => Response.json(url.endsWith("/locations") ? {} : {
      id: 41, active: true, galleries: {
        main: { title: "גלריה ראשית", pictures: ["/gallery/cover.jpg"] },
        unit: { title: "סוויטה טוהר", pictures: ["/gallery/tohar.jpg"] },
      },
      rooms: [{ roomID: 87, roomName: "סוויטת טוהר", roomCount: 1, maxGuests: 2,
        spaces: [{ title: "סוויטת טוהר", features: [{ description: "מיטה זוגית" }] }] }],
    }),
  });
  assert.equal(detail.images[0], "/api/vii/media/cover.jpg");
  assert.deepEqual(detail.rooms[0].images, ["/api/vii/media/tohar.jpg"]);
  assert.deepEqual(detail.rooms[0].featureGroups, [{ title: "סוויטת טוהר", items: ["מיטה זוגית"] }]);
});

test("a temporarily empty supplier room list does not erase accepted units", async () => {
  const accepted = supplierPlaceDetail("vacation-41");
  const detail = await liveSupplierPlaceDetail("vacation-41", {
    token: "test-token",
    fallback: accepted,
    fetchImpl: async (url) => Response.json(url.endsWith("/locations") ? {} : {
      id: 41, active: true, galleries: {
        main: { title: "גלריה ראשית", pictures: ["/gallery/cover.jpg"] },
        unit: { title: "סוויטה טוהר", pictures: ["/gallery/tohar.jpg"] },
      },
      rooms: [],
    }),
  });
  assert.equal(detail.images[0], "/api/vii/media/cover.jpg");
  assert.deepEqual(detail.rooms.map((room) => room.id), [85, 86, 87]);
  assert.deepEqual(detail.rooms[2].images, ["/api/vii/media/tohar.jpg"]);
  assert.equal(detail.units, 3);
  assert.equal(detail.guests, 7);
});

test("live detail restores supplier amenities and capacity fields from the types endpoint", async () => {
  const detail = await liveSupplierPlaceDetail("vacation-1", {
    token: "test-token",
    fetchImpl: async (url) => {
      if (url.endsWith("/locations")) return Response.json({});
      if (url.endsWith("/vacations/types")) return Response.json({
        roomTypes: [{ id: 7, title: "וילה" }],
        amenity_categories: [{ categoryID: 9, categoryName: "אבזור" }],
        amenities: [{ id: 70, categoryID: 9, title: "מייבש כביסה" }, { id: 71, categoryID: 9, title: "חניה פרטית" }],
      });
      return Response.json({
        id: 1, active: true, name: "בדיקה", location: {}, galleries: { main: { pictures: ["/gallery/main.jpg"] } },
        shared_amenities: [{ id: 71, description: "" }],
        rooms: [{ roomID: 9, roomName: "הווילה", roomType: 7, roomCount: 1, maxGuests: 10,
          maxAdults: 8, maxKids: 2, showKidsAndAdults: 1, basisGuests: 6,
          amenities: [{ id: 70, shown: true, description: "" }], spaces: [] }],
      });
    },
  });
  assert.deepEqual(detail.features, ["חניה פרטית"]);
  assert.equal(detail.rooms[0].roomType, "וילה");
  assert.equal(detail.rooms[0].basisGuests, 6);
  assert.equal(detail.rooms[0].maxAdults, 8);
  assert.equal(detail.rooms[0].maxKids, 2);
  assert.ok(detail.rooms[0].features.includes("מייבש כביסה"));
});
