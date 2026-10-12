import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const searchBox = await readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const placeInventory = await readFile(new URL("../app/data/search-place-inventory.ts", import.meta.url), "utf8");
const localeProvider = await readFile(new URL("../app/i18n/locale-provider.tsx", import.meta.url), "utf8");

test("destination search indexes named places in every bookable world", () => {
  assert.match(searchBox, /fetch\(`\/api\/catalog\?world=\$\{world\}&view=lookup`/);
  assert.match(searchBox, /cache: "no-store"/);
  assert.match(placeInventory, /mode === "vacation"/);
  assert.match(placeInventory, /mode === "events"/);
  assert.match(placeInventory, /mode === "spa"/);
  assert.match(placeInventory, /mode === "hourly"/);
  assert.match(searchBox, /place\.name, place\.location, place\.area/);
});

test("named place results are distinct from region and town suggestions", () => {
  assert.match(searchBox, /translate\("מקומות מתאימים"\)/);
  assert.match(searchBox, /translate\("אזורים ויישובים"\)/);
  assert.match(searchBox, /<Link key=\{`\$\{mode\}-\$\{place\.id\}`\} className="location-place-result" href=\{localizedPath\(place\.href, language\)\}>/);
  assert.match(searchBox, /הקלידו עיר, אזור או שם מקום/);
});

test("opening a named place navigates directly in every world", () => {
  assert.match(placeInventory, /`\/business\?id=\$\{id\}`/);
  assert.match(placeInventory, /`\/events\/place\/\$\{id\}`/);
  assert.match(placeInventory, /`\/discover\/place\/\$\{id\}`/);
  assert.match(searchBox, /localizedPath\(place\.href, language\)/);
  assert.match(searchBox, /placeInventoryError \? <p role="alert">/);
  assert.doesNotMatch(searchBox, /choosePlace/);
  assert.doesNotMatch(searchBox, /selectedPlaceRef/);
});

test("new place-search copy is localized in English, Russian and French", () => {
  assert.equal((localeProvider.match(/"הקלידו עיר, אזור או שם מקום"/g) ?? []).length, 3);
  assert.equal((localeProvider.match(/"מקומות מתאימים"/g) ?? []).length, 3);
  assert.equal((localeProvider.match(/"אזורים ויישובים"/g) ?? []).length, 3);
});
