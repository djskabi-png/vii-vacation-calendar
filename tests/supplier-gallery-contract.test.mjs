import assert from "node:assert/strict";
import test from "node:test";
import { buildApiGalleryContract, compareGalleryContracts, orderedObjectEntries, parseOrderedJson } from "../app/lib/supplier-gallery-contract.ts";

test("ordered numeric gallery keys preserve wire order and reject duplicate keys", () => {
  const parsed = parseOrderedJson('{"galleries":{"9":{"pictures":[{"id":"nine"}]},"2":{"pictures":[{"id":"two"}]}}}');
  assert.deepEqual(orderedObjectEntries(parsed.galleries).map(([key]) => key), ["9", "2"]);
  assert.throws(() => parseOrderedJson('{"a":1,"a":2}'), /duplicate/);
});

test("API contract keeps place and duplicate-name units as separate ordered entities", async () => {
  const raw = { galleryGroups: [{ id: "place", title: "כללי", images: ["https://vii.spaplus.co/gallery/shared", "p2"] }], rooms: [
    { id: 9, name: "סוויטה", images: ["https://vii.spaplus.co/gallery/shared", "u9-2"] },
    { id: 2, name: "סוויטה", images: ["/api/vii/media/shared"] },
  ] };
  const contract = await buildApiGalleryContract("vacations", 2728, raw);
  assert.deepEqual(contract.entities.map((entity) => entity.entityKey), ["vacations:2728:place", "vacations:2728:room:9", "vacations:2728:room:2"]);
  assert.deepEqual(contract.entities[1].imageIds, ["shared", "u9-2"]);
  assert.deepEqual(contract.entities[2].imageIds, ["shared"]);
  assert.equal(compareGalleryContracts(contract, { ...contract, entities: [...contract.entities].reverse() }).equal, false);
});

test("SPA summary gallery and packages preserve IDs and canonical image identity", async () => {
  const contract = await buildApiGalleryContract("spa", 55, { gallery: ["https://vii.spaplus.co/gallery/a"], packages: [{ MainPageID: "p1", idPack: "booking1", image: "/api/vii/media/a" }, { MainPageID: "p2", pack_picture: "https://vii.spaplus.co/gallery/b" }] });
  assert.deepEqual(contract.entities.map((entity) => entity.entityKey), ["spa:55:place", "spa:55:package:p1", "spa:55:package:p2"]);
  assert.deepEqual(contract.entities.map((entity) => entity.imageIds), [["a"], ["a"], ["b"]]);
});

test("missing unit IDs are rejected instead of becoming a shared entity", async () => {
  await assert.rejects(() => buildApiGalleryContract("vacations", 1, { rooms: [{ name: "missing", images: ["x"] }] }), /invalid_gallery_owner_id/);
});
