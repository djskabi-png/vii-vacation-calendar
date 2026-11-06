import test from "node:test";
import assert from "node:assert/strict";
import { localGalleryMediaUrl } from "../app/lib/legacy-gallery-media.ts";
import { sergeyPlaceGalleryGroups, sergeyRoomImages } from "../app/lib/sergey-gallery.ts";
import { projectSergeyPublicCatalogValue } from "../app/lib/sergey-public-catalog-projection.ts";

test("quarantines the verified bad StayLoft file across local, legacy and query-bearing forms", () => {
  const bad = [
    "/api/vii/media/796a2fc6bf52100.png",
    "/api/vii/media/796a2fc6bf52100.png?width=640&q=82",
    "/gallery/796a2fc6bf52100.png",
    "https://www.vii.co.il/gallery/796a2fc6bf52100.png",
    "https://www.vii.co.il/gallery/796a2fc6bf52100.png?width=640",
  ];
  for (const value of bad) assert.equal(localGalleryMediaUrl(value), null, value);
  assert.equal(localGalleryMediaUrl("/gallery/796a2fc6bf52100.png%3Fbad"), null);
  assert.equal(localGalleryMediaUrl("/gallery/stayloft-valid.png"), "/api/vii/media/stayloft-valid.png");
});

test("drops only the quarantined item while preserving place and unit gallery identity", () => {
  const groups = sergeyPlaceGalleryGroups([{
    title: "גלריה כללית",
    pictures: ["/api/vii/media/796a2fc6bf52100.png", "/api/vii/media/stayloft-valid.png"],
  }]);
  assert.deepEqual(groups, [{ title: "גלריה כללית", images: ["/api/vii/media/stayloft-valid.png"] }]);

  const unit = sergeyRoomImages({
    roomID: 1153,
    galleries: [{ roomID: 1153, pictures: ["/gallery/796a2fc6bf52100.png", "/gallery/stayloft-unit.png"] }],
  }, [{ roomID: 999, pictures: ["/gallery/other-business.png"] }]);
  assert.deepEqual(unit, ["/api/vii/media/stayloft-unit.png"]);
});

test("matches a provider's expanded unit gallery title without borrowing generic galleries", () => {
  const galleries = [
    { title: "גלריה כללית", pictures: ["/gallery/property.png"] },
    { title: "יחידות אירוח עם ג'קוזי", pictures: ["/gallery/jacuzzi-unit.png"] },
    { title: "יחידות אירוח", pictures: ["/gallery/regular-unit.png"] },
  ];
  assert.deepEqual(sergeyRoomImages({ roomID: 4146, roomName: "יחידות עם ג'קוזי" }, galleries), [
    "/api/vii/media/jacuzzi-unit.png",
  ]);
  assert.deepEqual(sergeyRoomImages({ roomID: 4147, roomName: "יחידות אירוח" }, galleries), [
    "/api/vii/media/regular-unit.png",
  ]);
  assert.deepEqual(sergeyRoomImages({ roomID: 3689, roomName: "צימר משפחתי" }, galleries), []);
});

test("projects a quarantined cover to the first valid image from the same business", () => {
  const projected = projectSergeyPublicCatalogValue({
    world: "events",
    supplierId: 1153,
    image: "/api/vii/media/796a2fc6bf52100.png",
    images: ["/api/vii/media/796a2fc6bf52100.png", "/api/vii/media/stayloft-valid.png"],
  });
  assert.equal(projected.image, "/api/vii/media/stayloft-valid.png");
  assert.deepEqual(projected.images, ["/api/vii/media/stayloft-valid.png"]);
  assert.equal(projectSergeyPublicCatalogValue({ world: "events", image: "/api/vii/media/796a2fc6bf52100.png" }).image, null);
});
