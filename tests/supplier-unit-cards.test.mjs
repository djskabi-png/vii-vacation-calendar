import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { liveSupplierPlaceDetail, supplierPlaceDetail } from "../app/data/supplier-place-detail.ts";

function fixture(roomID) {
  return { token: "fixture-token", fetchImpl: async (url) => Response.json(url.endsWith("/locations") ? {} : {
    id: 2662, active: true, name: "שם בדיקה", galleries: {
      main: { title: "מתחם", pictures: ["/gallery/complex.jpg"] },
      unit: { title: "יחידה מאומתת", pictures: ["/gallery/unit.jpg"] },
    }, rooms: [{ ...(roomID === undefined ? {} : { roomID }), roomName: "יחידה מאומתת", roomCount: 2, maxGuests: 4, bedrooms: 1 }],
  }) };
}

test("unit gallery association requires a current positive supplier room identifier", async () => {
  const detail = await liveSupplierPlaceDetail("vacation-2662", fixture(4487));
  assert.equal(detail.rooms[0].id, 4487);
  assert.deepEqual(detail.rooms[0].images, ["https://www.vii.co.il/gallery/unit.jpg"]);
  assert.equal(detail.rooms[0].quantity, 2);
  assert.equal(detail.rooms[0].bedrooms, 1);
  for (const id of [undefined, 0, -1, "4487"]) {
    const missing = await liveSupplierPlaceDetail("vacation-2662", fixture(id));
    assert.equal(missing.rooms[0].id, undefined);
    assert.deepEqual(missing.rooms[0].images, []);
    assert.equal(missing.rooms[0].name, "יחידה מאומתת");
    assert.equal(missing.images.length, 2);
  }
});

test("active catalog retains the verified October 11 supplier room identities and counts", async () => {
  const catalog = JSON.parse(await readFile(new URL("../app/data/sergey-public-catalog.json", import.meta.url)));
  assert.equal(catalog.places.length, 702);
  assert.ok(catalog.places.some((place) => place.slug === "vacation-389"));
  for (const slug of ["vacation-464", "event-464"]) {
    assert.deepEqual(supplierPlaceDetail(slug).rooms.map((room) => [room.id, room.name, room.quantity, room.bedrooms]), [
      [1131, "בית האצילים", 1, 1], [4574, "מצודת דוד", 1, 1], [4575, "מצודת לונדון", 1, 1],
    ]);
  }
  assert.deepEqual(supplierPlaceDetail("vacation-2528").rooms.map((room) => [room.id, room.name, room.quantity, room.bedrooms, room.images]), [
    [4328, "הוילה בוטיק בספסופה", 1, 10, []],
  ]);
});

test("supplier request requires a verified detail room as well as the exact vacancy quote", async () => {
  const business = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
  const booking = await readFile(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/booking/page.tsx", import.meta.url), "utf8");
  assert.match(business, /property\.roomOptions\?\.some\(\(room\) => room\.supplierRoomID === supplierQuote\.roomIDs\[0\]\)/);
  assert.match(business, /תמונת המתחם, לא היחידה/);
  assert.match(page, /await liveSupplierPlaceDetail\(property\.slug\)/);
  assert.match(page, /supplierRoomVerified: Boolean\(supplierRoomID && selectedUnit\)/);
  assert.match(booking, /props\.supplierRoomVerified && props\.supplierRoomID && supplierQuote\.roomIDs\.includes\(props\.supplierRoomID\)/);
  assert.match(booking, /המקום אישר את ההזמנה\. לא בוצע חיוב דרך VII\./);
  assert.match(booking, /המקום קיבל את הבקשה והיא ממתינה לאישורו\./);
  assert.match(booking, /if \(supplierSiteID && !isManage\) \{\s*const response = await fetch\("\/api\/vii\/booking"/);
});
