import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const card = await readFile(new URL("../app/components/property-card.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const search = await readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const searchBox = await readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const taxonomy = await readFile(new URL("../app/data/search-taxonomy.ts", import.meta.url), "utf8");

const scenarios = {
  "aqua-resort": "available-price",
  "kesem-harimon": "price-only",
  "ahuzat-or": "available-no-price",
  "sol-gilgal": "no-data",
  "anael-estate": "unavailable",
  "magic-garden-gefen": "unavailable-alternatives",
  "perfumes-villa": "unavailable-price",
};

test("all seven illustrative availability states are deterministic", () => {
  for (const [slug, kind] of Object.entries(scenarios)) {
    assert.match(card, new RegExp(`"${slug}": "${kind}"`));
  }
  assert.match(card, /basePath !== "\/search" && basePath !== "\/vacations"/);
  assert.match(card, /availabilityDemoStay = \{ from: "2026-09-04", till: "2026-09-06" \}/);
  assert.match(card, /replace\(\/\\\/\+\$\/, ""\)/, "demo scenarios should work on both /search and /search/");
  assert.match(card, /isAvailabilityDemoSearch\(selectedStay, requestedLocation\)/);
  assert.match(card, /isWholeCountrySelection\(requestedLocation\)/);
  assert.match(search, /availabilityDemoSlugs\.indexOf\(a\.slug\)/);
  assert.match(search, /else setArea\("\u05d4\u05db\u05dc"\)/, "an omitted whole-country location must clear a previously selected area");
  assert.match(search, /selectedExtras, sort, searchQuery\]\)/, "a new date search must clear stale map viewport results");
  assert.match(search, /availability-demo-summary/);
});

test("an ordinary whole-country search carries the selected stay without a demo-only query flag", () => {
  assert.match(searchBox, /if \(vacationDateRange\.from\) params\.set\("from", vacationDateRange\.from\)/);
  assert.match(searchBox, /if \(vacationDateRange\.till\) params\.set\("till", vacationDateRange\.till\)/);
  assert.match(searchBox, /language !== "he" \? "all-country"/);
  assert.match(taxonomy, /"all-country"/);
  assert.match(taxonomy, /isWholeCountrySelection\(selection\)/);
  assert.match(search, /!isWholeCountrySelection\(requestedArea\)/);
  assert.match(searchBox, /vacationParty\.adults === 2 && vacationParty\.children === 0\) params\.set\("guests", "2"\)/);
  assert.doesNotMatch(searchBox, /params\.set\("(?:demo|availabilityDemo)"/);
  assert.match(taxonomy, /if \(!selection\) return true;/);
});

test("illustrative data is visibly identified and localized", () => {
  assert.match(card, /stay-card__demo-label/);
  assert.match(card, /illustrative: true/);
  assert.match(card, /Display example only/);
  assert.match(card, /Exemple d\\u2019affichage uniquement/);
  assert.match(card, /\\u05d4\\u05de\\u05d7\\u05e9\\u05ea/);
  assert.match(card, /\\u0422\\u043e\\u043b\\u044c\\u043a\\u043e/);
});

test("availability states render dates, prices and alternatives independently", () => {
  assert.match(card, /showSelectedDates: false/);
  assert.match(card, /nightlyPrice: 1300/);
  assert.match(card, /nightlyPrice: 1100/);
  assert.match(card, /nightlyPrice: 1600/);
  assert.match(card, /nightlyPrice: 2400/);
  assert.match(card, /alternatives: \[7, 14\]/);
  assert.match(card, /resolvedAvailability\.alternatives\?\.length/);
  assert.match(card, /resolvedAvailability\.showSelectedDates/);
});

test("availability presentation remains compact and responsive", () => {
  assert.match(css, /\.stay-card__date-status-row \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.stay-card__demo-label \{[^}]*font: 800 \.67rem\/1\.25 var\(--font-sans\)/);
  assert.match(css, /\.stay-card__alternatives > div \{[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.stay-card__alternatives small \{[^}]*white-space: normal/);
});
