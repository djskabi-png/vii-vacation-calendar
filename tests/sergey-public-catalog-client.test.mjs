import assert from "node:assert/strict";
import { test } from "node:test";
import { createSergeyPublicCatalogClient } from "../app/lib/sergey-public-catalog-client.ts";

function client(override = {}, extraPlace = false, listOverride = {}) {
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
    if (path === "/vacations/types") return Response.json({
      roomTypes: [{ id: 2, title: "סוויטה" }],
      amenity_categories: [{ categoryID: 1, categoryName: "מתקנים" }],
      amenities: [
        { id: 101, categoryID: 1, title: "חניה פרטית" },
        { id: 102, categoryID: 1, title: "מכונת כביסה" },
        { id: 103, categoryID: 1, title: "בריכה", filterTitle: "בריכה" },
        { id: 104, parentID: 103, categoryID: 1, title: "בריכת אינפיניטי" },
      ],
    });
    if (path === "/vacations") return Response.json({ places: [{ siteID: 17, active: true, ...listOverride }, ...(extraPlace ? [{ siteID: 18, active: true }] : [])] });
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

test("resolves shared and room amenity IDs through the official types contract", async () => {
  const result = await client({
    shared_amenities: [{ id: 101, description: "" }],
    rooms: [{ roomID: 55, roomName: "סוויטה", roomType: 2, roomCount: 1, maxGuests: 4,
      maxAdults: 2, maxKids: 2, showKidsAndAdults: 1, basisGuests: 2,
      amenities: [{ id: 102, shown: true, description: "" }], spaces: [] }],
  }).fetchCandidate("vacations");
  const { summary, detail } = result.entries[0];
  assert.equal(summary.type, "סוויטה");
  assert.ok(summary.features.includes("חניה פרטית"));
  assert.ok(summary.features.includes("מכונת כביסה"));
  assert.deepEqual(detail.features, ["חניה פרטית"]);
  assert.equal(detail.rooms[0].basisGuests, 2);
  assert.equal(detail.rooms[0].maxAdults, 2);
  assert.equal(detail.rooms[0].maxKids, 2);
  assert.equal(detail.rooms[0].showKidsAndAdults, true);
  assert.equal(detail.rooms[0].roomType, "סוויטה");
  assert.ok(detail.rooms[0].features.includes("מכונת כביסה"));
});

test("hidden child amenities remain searchable through the official parent tree without leaking into visible facts", async () => {
  const result = await client({
    shared_amenities: [{ id: 104, shown: false, description: "" }],
  }).fetchCandidate("vacations");
  const { summary, detail } = result.entries[0];
  assert.equal(summary.features.includes("בריכת אינפיניטי"), false);
  assert.equal(detail.features.includes("בריכת אינפיניטי"), false);
  assert.ok(summary.searchFilterIds.includes("pool"));
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

test("preserves seasonal starting prices from the supplier list when detail omits them", async () => {
  const { summary } = (await client({}, false, { startPriceWinter: 900, startPriceSummer: 1400 }).fetchCandidate("vacations")).entries[0];
  assert.equal(summary.startPriceWinter, 900);
  assert.equal(summary.startPriceSummer, 1400);
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
  assert.deepEqual(detail.galleryGroups, [
    { title: "גלריה ראשית", images: ["https://www.vii.co.il/gallery/cover.jpg", "https://www.vii.co.il/gallery/second.jpg"] },
    { title: "סוויטה טוהר", images: ["https://www.vii.co.il/gallery/tohar.jpg"] },
  ]);
  assert.deepEqual(detail.rooms[0].images, ["https://www.vii.co.il/gallery/tohar.jpg"]);
  assert.deepEqual(detail.rooms[0].featureGroups, [{ title: "סוויטת טוהר", items: ["ג׳קוזי זוגי"] }]);
});

test("withholds a place without photos without discarding the rest of the catalog", async () => {
  const result = await client({ galleries: [] }, true).fetchCandidate("vacations");
  assert.deepEqual(result.entries.map((entry) => entry.supplierId), [18]);
});

test("an existing large catalog refreshes only a bounded rotating detail window and keeps accepted details", async () => {
  const requested = [];
  const previous = Array.from({ length: 100 }, (_, index) => ({ supplierId: index + 1,
    summary: { slug: `vacation-${index + 1}`, name: `מקום ${index + 1}`, image: "https://www.vii.co.il/gallery/old.jpg" },
    detail: { images: ["https://www.vii.co.il/gallery/old.jpg"], marker: index + 1 } }));
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname.replace("/api/ai/vii", "");
    if (path === "/locations") return Response.json({ cities: [{ id: 1, title: "חיפה", area: 2 }], areas: [{ id: 2, title: "חיפה והקריות" }] });
    if (path === "/vacations/types") return Response.json({ roomTypes: [], amenities: [], amenity_categories: [] });
    if (path === "/vacations") return Response.json({ places: previous.map((entry) => ({ siteID: entry.supplierId,
      siteName: entry.summary.name, active: true, location: { cityID: 1 }, galleries: [{ pictures: ["/gallery/list.jpg"] }], rooms: [] })) });
    const id = Number(path.split("/").at(-1)); requested.push(id);
    return Response.json({ id, active: true, name: `מקום ${id}`, location: { city: 1 },
      galleries: [{ pictures: ["/gallery/fresh.jpg"] }], rooms: [] });
  };
  const result = await createSergeyPublicCatalogClient({ apiKey: "test-key", fetchImpl,
    detailRefreshLimit: 7, now: () => new Date("2026-10-24T12:00:00Z") }).fetchCandidate("vacations", previous);
  assert.equal(result.entries.length, 100);
  assert.equal(requested.length, 7);
  assert.equal(result.entries.filter((entry) => entry.detail?.marker).length, 93);
});

test("a failing detail refresh preserves the accepted place instead of failing the whole generation", async () => {
  const old = (await client().fetchCandidate("vacations")).entries;
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname.replace("/api/ai/vii", "");
    if (path === "/locations") return Response.json({ cities: [{ id: 1, title: "חיפה", area: 2 }], areas: [{ id: 2, title: "חיפה והקריות" }] });
    if (path === "/vacations/types") return Response.json({ roomTypes: [], amenities: [], amenity_categories: [] });
    if (path === "/vacations") return Response.json({ places: [{ siteID: 17, siteName: "מתחם בדיקה", active: true,
      location: { cityID: 1 }, galleries: [{ pictures: ["/gallery/list.jpg"] }], rooms: [] }] });
    return new Response("temporary", { status: 503 });
  };
  const result = await createSergeyPublicCatalogClient({ apiKey: "test-key", fetchImpl,
    detailRefreshLimit: 1 }).fetchCandidate("vacations", old);
  assert.equal(result.entries.length, 1);
  assert.deepEqual(result.entries[0].detail, old[0].detail);
});
