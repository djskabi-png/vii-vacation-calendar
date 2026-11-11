import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("app/data/sergey-hourly-catalog.json", root)));
const worldData = await readFile(new URL("app/data/world-data.ts", root), "utf8");
const details = await readFile(new URL("app/data/hourly-details.ts", root), "utf8");
const card = await readFile(new URL("app/components/discovery-card.tsx", root), "utf8");

test("hourly discovery uses every imported supplier place and no old local inventory", () => {
  assert.equal(catalog.source, "accepted-public-catalog/rooms");
  assert.equal(catalog.places.length, 52);
  assert.equal(new Set(catalog.places.map((place) => place.id)).size, catalog.places.length);
  assert.match(worldData, /hourlyPlaces: DiscoveryItem\[\] = hourlyPlacesFromCatalog\(hourlyCatalog\.places\)/);
  assert.doesNotMatch(worldData, /curatedHourlyPlaces|verifiedDiscoveryItems\("hourly"\)/);
});

test("hourly prices retain duration and weekday/weekend source distinction", () => {
  const escape = catalog.places.find((place) => place.supplierId === 1915);
  assert.deepEqual(escape.rooms[0].rates.find((rate) => rate.duration === "3 שעות"), {
    duration: "3 שעות", weekday: 250, weekend: 250,
  });
  assert.match(details, /rate\.weekday/);
  assert.match(details, /rate\.weekend/);
  assert.match(details, /המחירים המוצגים הם מחירי בסיס/);
  assert.doesNotMatch(details, /API/);
});

test("a source room without its own gallery remains visible without invented room media", () => {
  const incomplete = catalog.places.flatMap((place) => place.rooms
    .filter((room) => !room.images.length)
    .map((room) => ({ supplierId: place.supplierId, roomId: room.id, room })));
  assert.deepEqual(incomplete.map(({ supplierId, roomId }) => ({ supplierId, roomId })), [{ supplierId: 1902, roomId: 3260 }]);
  assert.equal(incomplete[0].room.images.length, 0);
  assert.match(card, /item\.world !== "hourly"/);
  assert.match(card, /תמונה אינה זמינה/);
  assert.match(worldData, /startingPrice \? .* : undefined/);
});
