import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../app/data/sergey-public-catalog.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../app/lib/sergey-public-catalog-client.ts", import.meta.url), "utf8");

test("2697 accepted card keeps the supplier cover as first representative media", () => {
  const place = catalog.places.find((item) => item.supplierId === 2697);
  assert.equal(place?.image, "/api/vii/media/296aa7c5ed92d8e.jpeg");
  assert.equal(place?.images?.[0], place?.image);
  assert.match(source, /const cardImages = unique\(\[\.\.\.representativeImages, \.\.\.images\]\)/);
});

test("room media is not used as the card representative source", () => {
  assert.match(source, /const cardImages = unique\(\[\.\.\.representativeImages, \.\.\.images\]\)/);
  assert.match(source, /images: cardImages/);
  assert.match(source, /images: positive\(room\.roomID\) \? sergeyRoomImages/);
});
