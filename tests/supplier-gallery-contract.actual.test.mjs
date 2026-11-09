import assert from "node:assert/strict";
import test from "node:test";
import { buildApiGalleryContract, buildAcceptedGalleryContract, compareGalleryContracts, orderedObjectEntries, parseOrderedJson } from "../app/lib/supplier-gallery-contract.ts";
import { localGalleryMediaUrl, isQuarantinedGalleryMedia } from "../app/lib/legacy-gallery-media.ts";
import { sergeyPlaceGalleryGroups, sergeyRoomImages } from "../app/lib/sergey-gallery.ts";

test("actual API string-picture payload is retained as a non-empty ordered contract", async () => {
  const api = await buildApiGalleryContract("vacations", 2728, {
    galleries: [{ galleryID: 9, pictures: ["https://vii.spaplus.co/gallery/first.jpg", "https://vii.spaplus.co/gallery/second.jpg"] }],
    rooms: [{ roomID: 41, galleries: [{ galleryID: 2, pictures: ["https://vii.spaplus.co/gallery/unit.jpg"] }] }],
  });
  assert.equal(api.entities.length, 2);
  assert.deepEqual(api.entities[0].imageIds, ["first.jpg", "second.jpg"]);
  assert.deepEqual(api.entities[1].imageIds, ["unit.jpg"]);
});

test("the proven source 404 is excluded at the shared boundary and remains visible as an API finding", async () => {
  assert.equal(localGalleryMediaUrl('/api/vii/media/16670505013701.jpg'),null);
  assert.equal(isQuarantinedGalleryMedia('https://www.spaplus.co.il/gallery/16670505013701.jpg'),false);
  const contract=await buildApiGalleryContract('rooms',2417,{galleries:{main:{galleryID:1,pictures:['/gallery/a.jpg','/gallery/16670505013701.jpg','/gallery/b.jpg']}}});
  assert.deepEqual(contract.entities[0].imageIds,['a.jpg','b.jpg']);
  assert.deepEqual(contract.excludedImageIds,['16670505013701.jpg']);
});

test("accepted snapshot detail gallery groups compare equal to the same API generation", async () => {
  const raw = { supplierId: 2728, galleries: [{ galleryID: 9, pictures: ["https://vii.spaplus.co/gallery/first.jpg"] }], rooms: [{ roomID: 41, galleries: [{ galleryID: 2, pictures: ["https://vii.spaplus.co/gallery/unit.jpg"] }] }] };
  const api = await buildApiGalleryContract("vacations", 2728, raw);
  const accepted = await buildAcceptedGalleryContract("vacations", { supplierId: 2728, summary: {}, detail: { galleries: raw.galleries, rooms: raw.rooms } });
  assert.ok(api.entities.length > 0);
  assert.equal(compareGalleryContracts(api, accepted).equal, true);
});

test("same entity count with changed image order is not accepted", async () => {
  const expected = await buildApiGalleryContract("vacations", 7, { galleries: [{ galleryID: 9, pictures: ["a.jpg", "b.jpg"] }] });
  const actual = await buildApiGalleryContract("vacations", 7, { galleries: [{ galleryID: 9, pictures: ["b.jpg", "a.jpg"] }] });
  assert.equal(compareGalleryContracts(expected, actual).equal, false);
});

test("ordered parser preserves numeric gallery order and rejects duplicate keys and raw controls", () => {
  const parsed = parseOrderedJson('{"galleries":{"9":{"pictures":["nine"]},"2":{"pictures":["two"]}}}');
  assert.deepEqual(orderedObjectEntries(parsed.galleries).map(([key]) => key), ["9", "2"]);
  assert.throws(() => parseOrderedJson('{"a":1,"a":2}'), /duplicate/);
  assert.throws(() => parseOrderedJson('{"a":"bad\u0001"}'), /invalid/);
});

test("missing room identity cannot silently become an accepted room entity", async () => {
  await assert.rejects(() => buildApiGalleryContract("vacations", 2728, { rooms: [{ galleries: [{ galleryID: 2, pictures: ["unit.jpg"] }] }] }), /invalid_gallery_owner_id/);
});

test("an empty unit or package remains an owner and cannot pass a place-only comparison", async () => {
  const raw = { galleries: [{ galleryID: 1, pictures: ["place.jpg"] }], rooms: [{ roomID: 4, galleries: [] }] };
  const api = await buildApiGalleryContract("vacations", 7, raw);
  assert.equal(api.entities.length, 2);
  assert.equal(api.entities[1].imageIds.length, 0);
  const comparison = compareGalleryContracts(api, { ...api, source: "accepted" });
  assert.equal(comparison.equal, false);
  assert.ok(comparison.issues.some(issue => issue.includes("unverified_empty_owner_media")));
  await assert.rejects(() => buildApiGalleryContract("spa", 7, { packages: [{ idPack: 9, image: "a.jpg" }] }), /invalid_gallery_owner_id/);
});

test("duplicate room identities invalidate the source", async () => {
  await assert.rejects(() => buildApiGalleryContract("vacations", 2728, { rooms: [{ id: 41, images: ["a"] }, { id: 41, images: ["b"] }] }), /duplicate_gallery_owner_id/);
});

test("gallery normalizer preserves numeric provider keys and numeric IDs", () => {
  const groups = sergeyPlaceGalleryGroups(parseOrderedJson('{"9":{"title":"תשע","pictures":["nine.jpg"]},"2":{"title":"שתיים","pictures":["two.jpg"]}}'));
  assert.deepEqual(groups.map((group) => [group.id, group.title]), [["9", "תשע"], ["2", "שתיים"]]);
  assert.deepEqual(sergeyPlaceGalleryGroups([{ galleryID: 9, pictures: ["nine.jpg"] }])[0].id, "9");
});

test("explicit empty room galleries do not inherit a same-title place gallery", () => {
  assert.deepEqual(sergeyRoomImages({ roomID: 9, roomName: "סוויטה", galleries: [] }, [{ title: "סוויטה", pictures: ["wrong.jpg"] }]), []);
});

test("normalized room galleryGroups retain source IDs and order", async () => {
  const api = await buildApiGalleryContract("vacations", 2728, {
    galleryGroups: [{ id: "place-1", images: ["a.jpg"] }],
    rooms: [{ id: 41, galleryGroups: [{ id: "unit-1", images: ["u1.jpg", "u2.jpg"] }] }],
  });
  assert.deepEqual(api.entities.map((row) => [row.entityKey, row.galleryKey, row.imageIds]), [
    ["vacations:2728:place", "media", ["a.jpg"]],
    ["vacations:2728:room:41", "media", ["u1.jpg", "u2.jpg"]],
  ]);
});

test("foreign supplier contracts never compare equal", async () => {
  const left = await buildApiGalleryContract("events", 1, { images: ["a.jpg"] });
  const right = await buildApiGalleryContract("events", 2, { images: ["a.jpg"] });
  assert.equal(compareGalleryContracts(left, right).equal, false);
});

test("duplicate room owner IDs are rejected instead of collapsing two units", async () => {
  await assert.rejects(() => buildApiGalleryContract("vacations", 2728, { rooms: [
    { id: 41, images: ["u1.jpg"] },
    { id: 41, images: ["u2.jpg"] },
  ] }), /duplicate|owner|identity/i);
});

test("blank image strings are not accepted as gallery evidence", async () => {
  const contract = await buildApiGalleryContract("vacations", 2728, { galleries: [{ id: 9, images: ["", "   ", "real.jpg"] }] });
  assert.deepEqual(contract.entities[0].imageIds, ["real.jpg"]);
});

test("SPA package identity prefers MainPageID and keeps pack_picture as one image", async () => {
  const contract = await buildApiGalleryContract("spa", 55, { packages: [
    { MainPageID: 7, idPack: 8, pack_picture: "https://www.spaplus.co.il/gallery/package-7.jpg" },
    { MainPageID: 9, idPack: 10, pack_picture: "https://www.spaplus.co.il/gallery/package-9.jpg", image: "https://www.spaplus.co.il/gallery/ignored.jpg" },
  ] });
  assert.deepEqual(contract.entities.map((entity) => entity.entityKey), ["spa:55:package:7", "spa:55:package:9"]);
  assert.deepEqual(contract.entities.map((entity) => entity.imageIds), [["package-7.jpg"], ["package-9.jpg"]]);
});
