import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("app/data/sergey-hourly-catalog.json", root)));
const worldData = await readFile(new URL("app/data/world-data.ts", root), "utf8");
const details = await readFile(new URL("app/data/hourly-details.ts", root), "utf8");
const card = await readFile(new URL("app/components/discovery-card.tsx", root), "utf8");

test("hourly discovery uses every imported supplier place and no old local inventory", () => {
  assert.equal(catalog.source, "sergey-vii-api/rooms");
  assert.equal(catalog.places.length, 4);
  assert.equal(new Set(catalog.places.map((place) => place.id)).size, 4);
  assert.match(worldData, /hourlyPlaces: DiscoveryItem\[\] = hourlyCatalog\.places\.map/);
  assert.doesNotMatch(worldData, /curatedHourlyPlaces|verifiedDiscoveryItems\("hourly"\)/);
});

test("hourly prices retain duration and weekday/weekend source distinction", () => {
  const escape = catalog.places.find((place) => place.supplierId === 1915);
  assert.deepEqual(escape.rooms[0].rates.find((rate) => rate.duration === "3 שעות"), {
    duration: "3 שעות", weekday: 250, weekend: 250,
  });
  assert.match(details, /rate\.weekday/);
  assert.match(details, /rate\.weekend/);
  assert.match(details, /מחירי בסיס מה־API/);
});

test("supplier places without photos or rooms remain visible without invented content", () => {
  const incomplete = catalog.places.filter((place) => !place.images.length || !place.rooms.length);
  assert.equal(incomplete.length, 2);
  assert.ok(incomplete.every((place) => !place.rooms.length && !place.images.length));
  assert.match(card, /item\.world !== "hourly"/);
  assert.match(card, /לא נמסרה תמונה ב־API/);
  assert.match(worldData, /startingPrice \? .* : undefined/);
});
