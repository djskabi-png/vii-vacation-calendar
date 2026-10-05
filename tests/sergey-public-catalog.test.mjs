import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../app/data/sergey-public-catalog.json", import.meta.url)));
const report = JSON.parse(await readFile(new URL("../tmp/vii-sergey-stage-20261005/public-catalog-report.json", import.meta.url)));

test("public catalog contains only accepted supplier places", () => {
  assert.equal(catalog.source, "sergey-vii-api");
  assert.equal(catalog.fetchedAt, report.fetchedAt);
  assert.equal(catalog.places.length, 711);
  assert.deepEqual(report.accepted, { vacations: 581, events: 130 });
  assert.equal(report.rejected.length, 6);
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
