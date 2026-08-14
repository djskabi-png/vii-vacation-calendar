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
  assert.match(searchBox, /onClick=\{\(\) => choosePlace\(place\)\}/);
  assert.match(searchBox, /הקלידו עיר, אזור או שם מקום/);
});

test("opening a named place preserves the committed search context", () => {
  assert.match(searchBox, /if \(chosenPlace\)/);
  assert.match(searchBox, /params\.set\("source", "search"\)/);
  assert.match(searchBox, /params\.set\("from", vacationDateRange\.from\)/);
  assert.match(searchBox, /params\.set\("till", vacationDateRange\.till\)/);
  assert.match(searchBox, /params\.set\("guests", String\(vacationParty\.adults \+ vacationParty\.children\)\)/);
  assert.match(searchBox, /const searchParamsKey = searchParams\.toString\(\)/);
  assert.match(searchBox, /const selectedPlaceRef = useRef<PlaceSearchResult \| null>\(null\)/);
  assert.match(searchBox, /const chosenPlace = selectedPlaceRef\.current \|\| selectedPlace/);
  assert.match(searchBox, /selectedPlaceRef\.current = place/);
  assert.match(searchBox, /new URLSearchParams\(searchParamsKey\)/);
  assert.doesNotMatch(searchBox, /\[initialGuests, initialLocation, initialSpaAudience, language, mode, searchParams\]/);
  assert.match(searchBox, /const hasSelectedDates = mode === "vacation"/);
  assert.match(searchBox, /setCalendarOpen\(!hasSelectedDates\)/);
});

test("new place-search copy is localized in English, Russian and French", () => {
  assert.equal((localeProvider.match(/"הקלידו עיר, אזור או שם מקום"/g) ?? []).length, 3);
  assert.equal((localeProvider.match(/"מקומות מתאימים"/g) ?? []).length, 3);
  assert.equal((localeProvider.match(/"אזורים ויישובים"/g) ?? []).length, 3);
});
