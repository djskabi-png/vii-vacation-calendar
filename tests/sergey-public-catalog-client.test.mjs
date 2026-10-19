import assert from "node:assert/strict";
import { test } from "node:test";
import { createSergeyPublicCatalogClient } from "../app/lib/sergey-public-catalog-client.ts";

function client(override = {}, extraPlace = false) {
  const pictures = Array.from({ length: 14 }, (_, index) => `/gallery/photo-${index}.jpg`);
  const detail = {
    id: 17, active: true, name: "מתחם בדיקה", location: { city: 1 },
    galleries: { main: { title: "סוויטה", pictures } },
    summary: "<p>תיאור מקום</p>", meta: { description: "תיאור קצר" },
    rooms: [{ roomID: 55, roomName: "סוויטה", roomCount: 2, maxGuests: 4, bedrooms: 1,
      spaces: [{ features: [{ description: "בריכה" }] }] }],
    reviews: { score: 9.4, count: 1, list: [{ id: 4, author: "אורח", text: "נהדר", score: 10 }] },
    contact: { phone: "0501234567", whatsapp: "0501234567" },
    ...override,
  };
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test-key");
    const path = new URL(url).pathname.replace("/api/ai/vii", "");
    if (path === "/locations") return Response.json({ cities: [{ id: 1, title: "חיפה", area: 2 }], areas: [{ id: 2, title: "חיפה והקריות" }] });
    if (path === "/vacations") return Response.json({ places: [{ siteID: 17, active: true }, ...(extraPlace ? [{ siteID: 18, active: true }] : [])] });
    if (path === "/vacations/17") return Response.json(detail);
    if (path === "/vacations/18") return Response.json({ ...detail, id: 18, galleries: { main: { title: "סוויטה", pictures } } });
    return new Response("", { status: 404 });
  };
  return createSergeyPublicCatalogClient({ apiKey: "test-key", fetchImpl });
}

test("normalizes the full place gallery, rooms, reviews and explicit WhatsApp field", async () => {
  const result = await client().fetchCandidate("vacations");
  assert.equal(result.entries.length, 1);
  const { summary, detail } = result.entries[0];
  assert.equal(summary.slug, "vacation-17");
  assert.equal(summary.images.length, 14);
  assert.equal(detail.images.length, 14);
  assert.equal(detail.rooms[0].quantity, 2);
  assert.equal(detail.reviews.length, 1);
  assert.ok(summary.contact.whatsapp);
  assert.equal(Object.hasOwn(summary, "available"), false);
});

test("rejects inactive or mismatched place details", async () => {
  await assert.rejects(() => client({ id: 18 }).fetchCandidate("vacations"), /invalid_sergey_place/);
  await assert.rejects(() => client({ active: false }).fetchCandidate("vacations"), /invalid_sergey_place/);
});

test("preserves only valid new seasonal starting prices without creating a quote", async () => {
  const {summary}= (await client({startPriceWinter:1000,startPriceSummer:1500}).fetchCandidate("vacations")).entries[0];
  assert.equal(summary.startPriceWinter,1000);
  assert.equal(summary.startPriceSummer,1500);
  for(const key of ["price","nightlyPrice","onlineBooking","available"]) assert.equal(Object.hasOwn(summary,key),false);
  const invalid=(await client({startPriceWinter:0,startPriceSummer:"1500"}).fetchCandidate("vacations")).entries[0].summary;
  assert.equal(Object.hasOwn(invalid,"startPriceWinter"),false);
  assert.equal(Object.hasOwn(invalid,"startPriceSummer"),false);
});

test("keeps supplier gallery order and resolves the Suite Tohar naming difference", async () => {
  const result = await client({
    galleries: {
      first: { title: "גלריה ראשית", pictures: ["/gallery/cover.jpg", "/gallery/second.jpg"] },
      second: { title: "סוויטה טוהר", pictures: ["/gallery/tohar.jpg"] },
    },
    rooms: [{ roomID: 87, roomName: "סוויטת טוהר", maxGuests: 2, roomCount: 1,
      spaces: [{ title: "סוויטת טוהר", features: [{ description: "ג׳קוזי זוגי" }] }] }],
  }).fetchCandidate("vacations");
  const { summary, detail } = result.entries[0];
  assert.equal(summary.image, "https://www.vii.co.il/gallery/cover.jpg");
  assert.deepEqual(detail.images.slice(0, 2), ["https://www.vii.co.il/gallery/cover.jpg", "https://www.vii.co.il/gallery/second.jpg"]);
  assert.deepEqual(detail.rooms[0].images, ["https://www.vii.co.il/gallery/tohar.jpg"]);
  assert.deepEqual(detail.rooms[0].featureGroups, [{ title: "סוויטת טוהר", items: ["ג׳קוזי זוגי"] }]);
});

test("withholds a place without photos without discarding the rest of the catalog", async () => {
  const result = await client({ galleries: [] }, true).fetchCandidate("vacations");
  assert.deepEqual(result.entries.map((entry) => entry.supplierId), [18]);
});
