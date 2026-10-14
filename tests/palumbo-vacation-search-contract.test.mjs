import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("vacation search keeps accommodation type and price range visible", () => {
  const search = read("app/search/page.tsx");
  assert.match(search, />סוג מקום<\/button>/);
  assert.match(search, />טווח מחיר<\/button>/);
  assert.match(search, /טווח המחיר ייפתח לאחר בחירת תאריכים/);
  assert.match(search, /const inferredType = \/וילה\//);
});

test("map split synchronizes the active result card with its marker", () => {
  const search = read("app/search/page.tsx");
  const map = read("app/components/listing-map.tsx");
  const css = read("app/globals.css");
  assert.match(search, /onActiveChange=\{\(active\) => setActiveMapPropertyId\(active \? property\.slug : null\)\}/);
  assert.match(search, /activePlaceId=\{activeMapPropertyId\}/);
  assert.match(map, /classList\.toggle\("is-card-active", active\)/);
  assert.match(css, /\.airbnb-map-split__map \{ position: sticky/);
  assert.match(css, /html:has\(\.airbnb-map-split\),[\s\S]*overflow-x: clip; overflow-y: visible;/);
  assert.match(css, /\.vii-map-marker-wrap:not\(\.is-cluster\)\.is-card-active/);
});

test("vacation result cards use the full surface and the approved compact content", () => {
  const card = read("app/components/property-card.tsx");
  const css = read("app/globals.css");
  assert.match(card, /className="stay-card__surface-link"/);
  assert.doesNotMatch(card, /: <Link className="stay-card__details-link" href=\{propertyHref\}>/);
  assert.match(card, /const cardHighlights = .*slice\(0, 3\)/);
  assert.match(card, /property\.cardNote \? <span className="stay-card__public-note"/);
  assert.match(card, /language === "he" \? <ChevronRight/);
  assert.match(css, /\.stay-card \.heart-button\.universal-favorite \{[^}]*left: 14px; right: auto;/);
  assert.match(css, /\.stay-card__highlights \{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/);
});

test("content studio controls the five ordered highlights and public card note", () => {
  const admin = read("app/admin/content-studio/page.tsx");
  const inventory = read("app/lib/content-studio-inventory.ts");
  const publicCatalog = read("app/lib/public-catalog-read.ts");
  assert.match(admin, /5 מאפיינים מרכזיים, לפי הסדר ובפסיקים/);
  assert.match(admin, /הערה ציבורית על תמונת הכרטיס/);
  assert.match(inventory, /highlights: highlightList\(row\.highlights\)/);
  assert.match(publicCatalog, /selectedHighlights\.map\(\(label\) => \(\{ label, icon: "default" \}\)\)/);
  assert.match(publicCatalog, /content\.attributes\.cardNote/);
});
