import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../app/data/sergey-public-catalog.json", import.meta.url)));
const detailFile = JSON.parse(await readFile(new URL("../app/data/sergey-place-details.json", import.meta.url)));

test("every accepted supplier place has full detail data without broadening the search catalog", () => {
  assert.equal(Object.keys(detailFile.details).length, catalog.places.length);
  for (const place of catalog.places) {
    const detail = detailFile.details[place.slug];
    assert.ok(detail, place.slug);
    assert.ok(detail.images.length >= place.images.length, place.slug);
    assert.deepEqual(detail.images.slice(0, place.images.length), place.images);
    assert.ok(detail.rooms.length);
    assert.ok(detail.rooms.every((room) => Number.isSafeInteger(room.id) && room.id > 0 && Array.isArray(room.images)));
    assert.ok(detail.rooms.every((room) => room.images.every((src) => detail.images.includes(src))));
    assert.ok(detail.images.every((src) => src.startsWith("https://www.vii.co.il/gallery/")));
    assert.equal(detail.reviews.length, place.reviews || 0, place.slug);
    assert.ok(detail.reviews.every((review) => review.author && (review.text || Number.isFinite(review.score))));
  }
});

test("representative vacation and event pages retain their complete source galleries and facts", () => {
  assert.ok(detailFile.details["vacation-389"].rooms.length >= 3);
  assert.ok(detailFile.details["vacation-389"].reviews.length >= 1);
  assert.ok(detailFile.details["vacation-389"].images.length >= 23);
  assert.equal(detailFile.details["vacation-1"].images.length, 62);
  assert.equal(detailFile.details["vacation-1"].rooms.length, 2);
  assert.equal(detailFile.details["vacation-1"].rooms[0].id, 27);
  assert.equal(detailFile.details["vacation-1"].rooms[0].images.length, 18);
  assert.equal(detailFile.details["vacation-1"].rooms[1].images.length, 20);
  assert.equal(detailFile.details["vacation-389"].rooms[0].images.length, 0);
  assert.equal(detailFile.details["vacation-1"].policy.checkIn, "15:00:00");
  assert.equal(detailFile.details["vacation-1"].reviews.length, 20);
  assert.equal(catalog.places.find((place) => place.slug === "vacation-1").reviews, 20);
  assert.equal(detailFile.details["event-2"].images.length, 22);
  assert.doesNotMatch(detailFile.details["event-711"].summary, /1,999|מבצע חורף/);
});
