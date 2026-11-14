import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import catalog from "../app/data/sergey-hourly-catalog.json" with { type: "json" };
import { getHourlyDetails } from "../app/data/hourly-details.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("event details expose one feature disclosure and no redundant title action", () => {
  const source = read("app/events/place/client-page.tsx");
  assert.match(source, /const eventFeatures = useMemo/);
  assert.match(source, /<h2>\{translate\("מאפייני המקום"\)\}<\/h2>/);
  assert.equal((source.match(/<UnifiedAmenityList/g) || []).length, 1);
  assert.doesNotMatch(source, /translate\("בדיקת אירוע"\)/);
  assert.doesNotMatch(source, /CollapsibleFeatureList|mobileInitialCount/);
});

test("event preset pages render results directly and hide stale cards while loading", () => {
  const source = read("app/components/event-last-minute.tsx");
  assert.match(source, /layout === "grid" && !fixedPreset/);
  assert.match(source, /const hasRailItems = Boolean\(candidates\.length \|\| visibleAdditionalPlaces\.length\)/);
  assert.match(source, /!busy && hasRailItems/);
  assert.match(source, /displayEventDate\(offer\.from!\)/);
});

test("event WhatsApp handoff formats the chosen date for Israel", () => {
  const source = read("app/lib/event-whatsapp-inquiry.ts");
  assert.match(source, /formattedDate/);
  assert.match(source, /slice\(8, 10\).*slice\(5, 7\).*slice\(0, 4\)/);
  assert.match(source, /`\$\{copy\.date\} \$\{formattedDate\}`/);
});

test("hourly room projection preserves API room order, exact names and image order", () => {
  const place = catalog.places.find((entry) => entry.rooms.length > 1);
  assert.ok(place);
  const item = { id: place.id, description: place.description, features: [], images: place.images };
  const details = getHourlyDetails(item, place);
  assert.deepEqual(details.stayOptions.map((room) => room.roomId), place.rooms.map((room) => room.id));
  assert.deepEqual(details.stayOptions.map((room) => room.title), place.rooms.map((room) => room.name || "יחידת אירוח"));
  assert.deepEqual(details.stayOptions.map((room) => room.images || []), place.rooms.map((room) => room.images || []));
});

test("hourly feature disclosure uses one compact mobile section", () => {
  const source = read("app/discover/place/client-page.tsx");
  assert.match(source, /<h2>\{translate\("מאפייני המקום"\)\}<\/h2>/);
  assert.match(source, /<UnifiedAmenityList items=\{details\.amenities\} \/>/);
});

test("vacation geography starts closed and supports direct touch panning", () => {
  const component = read("app/components/vacation-geography-nav.tsx");
  const css = read("app/worlds/vacations/styles/world-owned.css");
  assert.equal((component.match(/<details>/g) || []).length, 2);
  assert.doesNotMatch(component, /<details open>/);
  assert.match(css, /overflow-x: scroll/);
  assert.match(css, /touch-action: pan-x/);
  assert.match(css, /-webkit-overflow-scrolling: touch/);
});
