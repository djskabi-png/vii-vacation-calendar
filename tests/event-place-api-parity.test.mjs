import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const client = fs.readFileSync(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8");
const projector = fs.readFileSync(new URL("../app/lib/event-place-detail.ts", import.meta.url), "utf8");
const gallery = fs.readFileSync(new URL("../app/components/gallery-experience.tsx", import.meta.url), "utf8");
const booking = fs.readFileSync(new URL("../app/components/vacation-booking-hub.tsx", import.meta.url), "utf8");
const publicCatalogRead = fs.readFileSync(new URL("../app/lib/public-catalog-read.ts", import.meta.url), "utf8");
const businessClient = fs.readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const details = JSON.parse(fs.readFileSync(new URL("../app/data/sergey-place-details.json", import.meta.url), "utf8")).details;

test("event projection preserves supplier gallery groups, grouped facilities and room measurements", () => {
  assert.match(projector, /galleryGroups: detail\.galleryGroups\?\.length \? detail\.galleryGroups : base\.galleryGroups/);
  assert.match(projector, /images: \[\.\.\.new Set\(\[\.\.\.\(detail\.images \|\| \[\]\), \.\.\.\(base\.images \|\| \[\]\)\]\)\]/);
  assert.match(projector, /featureGroups: featureGroups\.length \? featureGroups : base\.featureGroups/);
  assert.match(projector, /roomOptions: roomOptions\.length \? roomOptions : base\.roomOptions/);
  assert.match(projector, /builtArea: room\.builtArea/);
  assert.match(projector, /totalArea: room\.totalArea/);
  assert.match(client, /featureGroups\.map/);
  assert.match(client, /שטח בנוי/);
  assert.match(client, /שטח כללי/);
});

test("supplier-defined gallery topics remain distinct even when one image belongs to several topics", () => {
  assert.match(gallery, /const identity = `\$\{item\.category\}\\u0000\$\{item\.topic\}\\u0000\$\{item\.src\}`/);
  assert.match(gallery, /property\.images\.filter\(\(src\) => !groupedSources\.has\(src\)\)/);
  assert.match(gallery, /topic: "תמונות נוספות"/);
  for (const id of ["event-2", "event-65", "event-70", "event-124", "event-210"]) {
    const detail = details[id];
    assert.ok(detail.galleryGroups.length, `${id} must keep supplier gallery groups`);
    const memberships = detail.galleryGroups.reduce((sum, group) => sum + group.images.length, 0);
    assert.ok(memberships >= detail.images.length, `${id} must not lose grouped gallery membership`);
  }
});

test("accepted runtime detail is normalized to immutable local media before bundled groups are merged", () => {
  assert.match(publicCatalogRead, /import \{ localGalleryMediaUrl \} from "\.\/legacy-gallery-media\.ts"/);
  assert.match(publicCatalogRead, /function normalizedMediaArray/);
  assert.match(publicCatalogRead, /merged\.images = normalizedMediaArray\(accepted\.images\)/);
  assert.match(publicCatalogRead, /images: normalizedMediaArray\(room\.images\)/);
});

test("accepted features remain visible when supplier taxonomy groups are incomplete", () => {
  assert.match(businessClient, /function completeFeatureGroups/);
  assert.match(businessClient, /title: "מתקנים נוספים", items: ungrouped/);
  assert.match(businessClient, /const featureGroups = completeFeatureGroups\(/);
  assert.match(businessClient, /property\.features/);
  assert.match(client, /function completeFeatureGroups/);
  assert.match(client, /title: "מתקנים נוספים", items: ungrouped/);
  assert.match(client, /completeFeatureGroups\(place\.featureGroups, place\.features\)/);
  assert.match(client, /featureGroups\.map/);
});

test("selected place summaries use the same official public database as the catalog API", () => {
  const selectedFunction = publicCatalogRead.slice(
    publicCatalogRead.indexOf("export async function publicCatalogSelectedSummaries"),
    publicCatalogRead.indexOf("function contentTypeForWorld"),
  );
  assert.match(selectedFunction, /const \{ database: db \} = await publicCatalogDatabase\(\)/);
  assert.doesNotMatch(selectedFunction, /runtimeCatalogDatabase\(\)/);
  assert.match(selectedFunction, /readSupplierCatalogSelectedSummaries\(db, world, ids\)/);
});

test("vacation booking keeps available without price separate from unavailable and provider error", () => {
  assert.match(booking, /availability\.availability === "available"\) return nightlyPrice > 0 \? "available-price" : "available-no-price"/);
  assert.match(booking, /availabilityStatus === "error"\) return "check-error"/);
  assert.match(booking, /state === "available-no-price"\) return \{ title: "פנוי, המחיר דורש אישור"/);
  assert.match(booking, /state === "check-error"\) return \{ title: "לא הצלחנו לבדוק כרגע"/);
});
