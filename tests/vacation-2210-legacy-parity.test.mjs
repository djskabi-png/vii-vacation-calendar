import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("accepted legacy amenity parity keeps supplier topics instead of one generic group", async () => {
  const module = await import(new URL("../app/data/legacy-place-feature-groups.ts", import.meta.url));
  const groups = module.legacyPlaceFeatureGroups("vacation-2210");
  assert.deepEqual(groups.map((group) => group.title), [
    "מידע",
    "כללי",
    "מתחם חיצוני",
    "מתחם פנימי",
    "קהל יעד",
    "מטבח מאובזר",
    "חדרי הרחצה",
    "לציבור הדתי",
    "במיוחד לילדים",
    "ניתן להזמין",
  ]);
  assert.ok(groups.every((group) => group.items.length > 0));
  assert.notStrictEqual(groups, module.legacyPlaceFeatureGroups("vacation-2210"));
});

test("the place page keeps current supplier groups authoritative and hydrates only an empty snapshot", async () => {
  const source = await readFile(new URL("app/business/client-page.tsx", root), "utf8");
  assert.match(source, /supplierDetail\.featureGroups\?\.length \? supplierDetail\.featureGroups : legacyPlaceFeatureGroups\(base\.slug\) \|\| base\.featureGroups/);
});

test("descriptive bedroom names stay in where-you-sleep and a fallback property image opens the full gallery", async () => {
  const source = await readFile(new URL("app/business/client-page.tsx", root), "utf8");
  const mapper = await readFile(new URL("app/lib/verified-sleeping-rooms.ts", root), "utf8");
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(mapper, /\^חדר שינה\(\?:\\s\+\\d\+\)\?\(\?:\\s\*\[-–—:\]\\s\*\.\+\)\?\$/);
  assert.match(source, /room-card__image room-card__image--missing" type="button" data-gallery-trigger onClick=\{\(\) => openGallery\("all", 0\)\}/);
  assert.doesNotMatch(source, /room-card__image room-card__image--missing"><img/);
  assert.match(styles, /\.room-card__image \{[^}]*width: 100%;[^}]*min-width: 0;[^}]*max-width: 100%;[^}]*display: block;/);
  assert.match(styles, /\.room-card__image--missing \{ cursor: pointer; \}/);
});

test("QQQAAA continuously checks the public legacy bedroom and amenity contracts", async () => {
  const source = await readFile(new URL("app/lib/quality-platform.ts", root), "utf8");
  assert.match(source, /checkId: "place\.vacation\.legacy-parity"/);
  for (const label of ["חדר שינה 1 - סוויטת הורים", "מתחם חיצוני", "מתחם פנימי", "מטבח מאובזר", "חדרי הרחצה", "לציבור הדתי", "במיוחד לילדים", "ניתן להזמין"]) {
    assert.ok(source.includes(label), `missing QQQAAA guard: ${label}`);
  }
});
