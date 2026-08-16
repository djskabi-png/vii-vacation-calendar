import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const searchBox = await readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const localeProvider = await readFile(new URL("../app/i18n/locale-provider.tsx", import.meta.url), "utf8");

test("destination search indexes named places in every bookable world", () => {
  assert.match(searchBox, /properties\.map/);
  assert.match(searchBox, /eventPlaces\.map/);
  assert.match(searchBox, /mode === "spa" \? spaPlaces : hourlyPlaces/);
  assert.match(searchBox, /place\.name, place\.location, place\.area/);
});

test("named place results are distinct from region and town suggestions", () => {
  assert.match(searchBox, /translate\("מקומות מתאימים"\)/);
  assert.match(searchBox, /translate\("אזורים ויישובים"\)/);
  assert.match(searchBox, /<Link key=\{`\$\{mode\}-\$\{place\.id\}`\} className="location-place-result" href=\{localizedPath\(place\.href, language\)\}>/);
  assert.match(searchBox, /הקלידו עיר, אזור או שם מקום/);
});

test("opening a named place navigates directly in every world", () => {
  assert.match(searchBox, /href: `\/business\?id=\$\{place\.slug\}`/);
  assert.match(searchBox, /href: eventPlaceHref\(place\)/);
  assert.match(searchBox, /href: `\/discover\/place\/\$\{place\.id\}`/);
  assert.match(searchBox, /localizedPath\(place\.href, language\)/);
  assert.doesNotMatch(searchBox, /choosePlace/);
  assert.doesNotMatch(searchBox, /selectedPlaceRef/);
});

test("new place-search copy is localized in English, Russian and French", () => {
  assert.equal((localeProvider.match(/"הקלידו עיר, אזור או שם מקום"/g) ?? []).length, 3);
  assert.equal((localeProvider.match(/"מקומות מתאימים"/g) ?? []).length, 3);
  assert.equal((localeProvider.match(/"אזורים ויישובים"/g) ?? []).length, 3);
});
