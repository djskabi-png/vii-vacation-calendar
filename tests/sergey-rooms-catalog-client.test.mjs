import assert from "node:assert/strict";
import { test } from "node:test";
import { createSergeyRoomsCatalogClient } from "../app/lib/sergey-rooms-catalog-client.ts";

function client(detailOverride = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname.replace("/api/ai/vii", "");
    calls.push(path);
    assert.equal(options.headers.Authorization, "Bearer test-secret");
    if (path === "/rooms") return Response.json({ places: [{ siteID: 17, active: true }] });
    if (path === "/rooms/locations") return Response.json({
      cities: [{ id: 1, title: "חיפה", area: 2 }], areas: [{ id: 2, title: "חיפה והקריות" }],
    });
    if (path === "/rooms/17") return Response.json({
      id: 17, active: true, name: "חדר בדיקה", location: { city: 1 },
      galleries: { main: { pictures: ["/gallery/room.jpg"] } },
      rooms: [{ roomID: 71, roomName: "סוויטה", maxGuests: 2, roomCount: 1,
        basePrices: { hourPriceWeekday: 280, hourPriceWeekend: 340 },
        spaces: [{ features: [{ description: "<p>ג'קוזי</p>" }] }],
      }],
      ...detailOverride,
    });
    return new Response("", { status: 404 });
  };
  return { client: createSergeyRoomsCatalogClient({ apiKey: "test-secret", fetchImpl }), calls };
}

test("fetches and normalizes hourly rooms and their base rates", async () => {
  const subject = client();
  const result = await subject.client.fetchCandidate();
  assert.deepEqual(subject.calls.sort(), ["/rooms", "/rooms/17", "/rooms/locations"].sort());
  assert.equal(result.entries.length, 1);
  const place = result.entries[0].summary;
  assert.equal(place.name, "חדר בדיקה");
  assert.equal(place.location, "חיפה");
  assert.equal(place.images[0], "https://www.vii.co.il/gallery/room.jpg");
  assert.equal(place.rooms[0].rates[0].weekday, 280);
  assert.equal(place.rooms[0].features[0], "ג'קוזי");
  assert.equal(Object.hasOwn(place, "availability"), false);
});

test("rejects mismatched supplier identity and malformed room inventory", async () => {
  await assert.rejects(() => client({ id: 18 }).client.fetchCandidate(), /invalid_room_identity/);
  await assert.rejects(() => client({ rooms: [{ roomID: null, roomName: "חדר" }] }).client.fetchCandidate(), /invalid_room_inventory/);
});
