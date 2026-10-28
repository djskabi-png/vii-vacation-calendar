import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { verifiedSleepingRoomsFromProperty } = await import("../app/lib/verified-sleeping-rooms.ts");

test("a verified bedroom count survives a supplier group whose title is not a bedroom", () => {
  const rooms = verifiedSleepingRoomsFromProperty({
    scenario: "single",
    rooms: [{
      name: "צימרבוס בכנרת",
      quantity: 1,
      bedrooms: 1,
      features: ["מיטה זוגית", "בר עם כסאות בר", "מטבחון", "חדר רחצה פרטי"],
      featureGroups: [{ title: "צימרבוס", items: ["מיטה זוגית", "מטבחון"] }],
      images: [],
      supplierRoomID: 4396,
    }],
  });

  assert.deepEqual(rooms.map(({ name, bedroomCount, details, availableUnits }) => ({ name, bedroomCount, details, availableUnits })), [{
    name: "חדר שינה אחד",
    bedroomCount: 1,
    details: ["מיטה זוגית"],
    availableUnits: undefined,
  }]);
});

test("explicit bedroom groups remain authoritative and separate", () => {
  const rooms = verifiedSleepingRoomsFromProperty({
    scenario: "multi",
    rooms: [{
      name: "הווילה",
      quantity: 2,
      bedrooms: 2,
      features: ["מיטה זוגית", "מטבחון"],
      featureGroups: [
        { title: "חדר שינה 1 - הורים", items: ["מיטה זוגית"] },
        { title: "חדר שינה 2", items: ["2 מיטות יחיד"] },
      ],
      images: [],
      supplierRoomID: 77,
    }],
    availableUnitCounts: { 77: 1 },
  });

  assert.deepEqual(rooms.map(({ name, unitName, bedroomCount, totalUnits, availableUnits }) => ({ name, unitName, bedroomCount, totalUnits, availableUnits })), [
    { name: "חדר שינה 1 - הורים", unitName: "הווילה", bedroomCount: 1, totalUnits: 2, availableUnits: 1 },
    { name: "חדר שינה 2", unitName: "הווילה", bedroomCount: 1, totalUnits: 2, availableUnits: 1 },
  ]);
});

test("no bedroom data produces no fabricated sleeping section", () => {
  const rooms = verifiedSleepingRoomsFromProperty({
    scenario: "single",
    rooms: [{ name: "יחידה", quantity: 1, bedrooms: 0, features: ["מיטה זוגית"], featureGroups: [], images: [] }],
  });
  assert.deepEqual(rooms, []);
});

test("accepted runtime rooms without a legacy features array still render sleeping details", () => {
  const rooms = verifiedSleepingRoomsFromProperty({
    scenario: "single",
    rooms: [{
      name: "יחידה מרשומת עבר",
      quantity: 1,
      bedrooms: 1,
      featureGroups: [{ title: "היחידה", items: ["מיטה זוגית"] }],
    }],
  });

  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].name, "חדר שינה אחד");
  assert.deepEqual(rooms[0].details, ["סוגי המיטות נמסרים באישור המקום"]);
});

test("every vacation supplier room with a verified bedroom count produces where-you-sleep content", async () => {
  const catalog = JSON.parse(await readFile(new URL("../app/data/sergey-place-details.json", import.meta.url), "utf8"));
  const verifiedRooms = Object.entries(catalog.details).flatMap(([placeId, detail]) =>
    (detail.rooms || []).filter((room) => room.bedrooms > 0).map((room) => ({ placeId, room }))
  );
  assert.ok(verifiedRooms.length > 100, "expected broad supplier coverage");

  const missing = verifiedRooms.filter(({ room }) => !verifiedSleepingRoomsFromProperty({
    scenario: "single",
    rooms: [{
      name: room.name,
      quantity: room.quantity,
      bedrooms: room.bedrooms,
      features: room.features || [],
      featureGroups: room.featureGroups || [],
      images: room.images || [],
      supplierRoomID: room.id,
    }],
  }).length);

  assert.deepEqual(missing.map(({ placeId, room }) => `${placeId}:${room.id}`), []);
});
