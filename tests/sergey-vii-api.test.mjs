import assert from "node:assert/strict";
import { test } from "node:test";
import { createSergeyViiClient, ViiSupplierError } from "../app/lib/sergey-vii-api.ts";

function mockFetch(path, init) {
  assert.equal(init.headers.Authorization, "Bearer test-vii-token");
  assert.equal(init.cache, "no-store");
  if (path.endsWith("/locations")) return Promise.resolve(Response.json({ cities: [{ id: 7, title: "חיפה", area: 3 }], areas: [{ id: 3, title: "חיפה והכרמל" }] }));
  if (path.endsWith("/vacations")) return Promise.resolve(Response.json({ places: [
    { siteID: 11, siteName: "מקום אמיתי", active: true, location: { cityID: 7 }, galleries: [{ pictures: ["/gallery/one.jpeg"] }], reviews: { score: 9.4, count: 8 } },
    { siteID: 12, siteName: "לא פעיל", active: false, galleries: [{ pictures: ["/gallery/two.jpeg"] }] },
  ] }));
  if (path.endsWith("/vacations/11")) return Promise.resolve(Response.json({
    id: 11, name: "מקום אמיתי", active: true, location: { city: 7 },
    galleries: { 1: { pictures: ["/gallery/one.jpeg", "https://other.example/bad.jpeg"] } },
    highlights: ["בריכה"], contact: { phone: "050-1234567" }, rooms: [{ roomID: 4, roomName: "סוויטה", roomCount: 2, maxGuests: 4, bedrooms: 1 }],
  }));
  return Promise.resolve(new Response(null, { status: 404 }));
}

test("VII supplier list contains only active places with source media and locations", async () => {
  const client = createSergeyViiClient({ apiKey: "test-vii-token", fetchImpl: mockFetch });
  assert.deepEqual(await client.list("vacations"), [{
    id: 11, name: "מקום אמיתי", city: "חיפה", area: "חיפה והכרמל",
    image: "https://www.vii.co.il/gallery/one.jpeg", score: 9.4, reviewCount: 8,
  }]);
});

test("VII supplier detail reads rooms and never forwards third-party media", async () => {
  const client = createSergeyViiClient({ apiKey: "test-vii-token", fetchImpl: mockFetch });
  const place = await client.detail("vacations", 11);
  assert.equal(place?.phone, "050-1234567");
  assert.deepEqual(place?.images, ["https://www.vii.co.il/gallery/one.jpeg"]);
  assert.deepEqual(place?.rooms, [{ id: 4, name: "סוויטה", units: 2, maxGuests: 4, bedrooms: 1 }]);
});

test("VII supplier failures do not become local demo data or reveal credentials", async () => {
  const missing = createSergeyViiClient({ apiKey: " " });
  await assert.rejects(missing.list("vacations"), { code: "missing_api_key" });
  const denied = createSergeyViiClient({ apiKey: "test-vii-token", fetchImpl: async () => new Response(null, { status: 403 }) });
  await assert.rejects(denied.list("events"), (error) => error instanceof ViiSupplierError && error.code === "not_authorized" && !error.message.includes("test-vii-token"));
});
