import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../app/data/sergey-public-catalog.json", import.meta.url)));

test("public catalog contains only accepted supplier places", () => {
  assert.equal(catalog.source, "sergey-vii-api");
  assert.equal(catalog.fetchedAt, "2026-10-05T10:29:43.514Z");
  assert.equal(catalog.places.length, 711);
  assert.equal(catalog.places.filter((place) => place.world === "vacations").length, 581);
  assert.equal(catalog.places.filter((place) => place.world === "events").length, 130);
  for (const [world, ids] of [["vacations", [927, 1156, 2234, 2434]], ["events", [2148, 2684]]]) {
    assert.ok(!catalog.places.some((place) => place.world === world && ids.includes(place.supplierId)));
  }
  assert.equal(new Set(catalog.places.map((place) => `${place.world}:${place.supplierId}`)).size, 711);
  assert.ok(catalog.places.every((place) =>
    place.slug === `${place.world === "vacations" ? "vacation" : "event"}-${place.supplierId}`
    && place.sourceUrl.startsWith("https://www.vii.co.il/")
    && place.images.length > 0 && place.images.length <= 12
    && place.images.every((image) => image.startsWith("https://www.vii.co.il/gallery/"))
    && place.lat >= 29 && place.lat <= 34 && place.lng >= 34 && place.lng <= 36));
  assert.ok(!catalog.places.some((place) => ["aqua-resort", "hilat-hanof", "vacation-tepers-estate"].includes(place.slug)));
  assert.ok(catalog.places.every((place) => place.price === undefined && place.dateQuotes === undefined && place.dailyAvailability === undefined));
});
