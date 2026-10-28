import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("sleeping details start with two rows and can expand independently", async () => {
  const source = await read("app/components/room-sleeping-preview.tsx");
  assert.match(source, /groups\.slice\(0, 2\)/);
  assert.match(source, /useState\(false\)/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /\$\{remaining\} \$\{translate\("חדרי שינה נוספים"\)\}/);
  assert.match(source, /הצגת פחות/);
});

test("unit details preserve all grouped and ungrouped amenities", async () => {
  const source = await read("app/components/unit-details-dialog.tsx");
  assert.match(source, /groupedFeatures/);
  assert.match(source, /ungroupedFeatures/);
  assert.match(source, /מאפיינים נוספים ביחידה/);
  assert.match(source, /<FeatureIcon label=\{item\}/);
});

test("supplier room sizes and base-price guests remain distinct", async () => {
  const mapping = await read("app/data/supplier-place-detail.ts");
  const client = await read("app/lib/sergey-public-catalog-client.ts");
  const dialog = await read("app/components/unit-details-dialog.tsx");
  const page = await read("app/business/client-page.tsx");
  for (const source of [mapping, client]) {
    assert.match(source, /builtArea:[^\n]*roomSize/);
    assert.match(source, /totalArea:[^\n]*totalSize/);
    assert.match(source, /area:[^\n]*roomSize/);
  }
  assert.match(dialog, /שטח בנוי/);
  assert.match(dialog, /שטח כללי/);
  assert.match(dialog, /translate\("מחיר הבסיס עד"\).*room\.basisGuests.*translate\("אורחים"\)/s);
  assert.match(page, /room\.basisGuests \? ` \$\{translate\("עד"\)\} \$\{room\.basisGuests\} \$\{translate\("אורחים"\)\}`/);
});

test("the existing address action activates and scrolls to the lazy map", async () => {
  const page = await read("app/business/client-page.tsx");
  assert.match(page, /className="property-location-action"[^>]*onClick=\{openLocationMap\}/);
  assert.doesNotMatch(page, /className="property-map-action"/);
  assert.match(page, /setMapActivated\(true\)/);
  assert.match(page, /getElementById\("location"\)\?\.scrollIntoView/);
  assert.match(page, /autoLoad=\{mapActivated\}/);
});

test("mobile contact layout remains compact without a duplicate map control", async () => {
  const css = await read("app/direct-phone-link.css");
  assert.match(css, /grid-template-columns:minmax\(112px,1\.1fr\) minmax\(0,1fr\) 44px/);
  assert.doesNotMatch(css, /\.property-map-action/);
});
