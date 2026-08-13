import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const card = await readFile(new URL("../app/components/property-card.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const search = await readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const searchBox = await readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const taxonomy = await readFile(new URL("../app/data/search-taxonomy.ts", import.meta.url), "utf8");

const firstPeriodScenarios = {
  "aqua-resort": "available-price",
  "kesem-harimon": "price-only",
  "ahuzat-or": "available-no-price",
  "sol-gilgal": "no-data",
  "anael-estate": "unavailable",
  "magic-garden-gefen": "unavailable-alternatives",
  "perfumes-villa": "unavailable-price",
};

test("all seven illustrative availability states are deterministic", () => {
  for (const [slug, kind] of Object.entries(firstPeriodScenarios)) {
    assert.match(card, new RegExp(`"${slug}": "${kind}"`));
  }
  for (const slug of ["ar-suites", "infinity-suites", "rose-estate"]) assert.match(card, new RegExp(`"${slug}"`));
  assert.match(card, /demoAvailabilityScenarios: Array<Record<string, DemoAvailabilityKind>>/);
  assert.match(card, /demoSeptemberPeriod\(selectedStay\.from\)/);
  assert.match(card, /stableDemoIndex\(property\.slug\)/, "legacy catalog places must also receive deterministic September examples");
  assert.match(card, /demoAvailabilityKinds\[\(stableIndex \+ period\) % demoAvailabilityKinds\.length\]/);
  assert.match(card, /demoPriceRange\[stableIndex % demoPriceRange\.length\]/);
  assert.doesNotMatch(card, /basePath !== "\/search" && basePath !== "\/vacations"/, "semantic result routes must not disable availability examples");
  assert.match(card, /availabilityDemoStay = \{ from: "2026-09-04", till: "2026-09-06" \}/);
  assert.doesNotMatch(card, /basePath/, "availability examples must not depend on the result route shape");
  assert.match(card, /isAvailabilityDemoSearch\(selectedStay, requestedLocation\)/);
  assert.match(card, /arrival < departure/);
  assert.match(card, /void requestedLocation/);
  assert.match(search, /availabilityDemoSlugs\.indexOf\(a\.slug\)/);
  assert.match(card, /export function hasAvailablePriceForSearch/);
  assert.match(card, /resolvedAvailability\?\.availability === "available"/);
  assert.match(card, /resolvedAvailability\.nightlyPrice > 0/);
  assert.equal(search.match(/const availabilityPriority = Number\(hasAvailablePriceForSearch\(b,/g)?.length, 2, "list and map-visible results must share the availability-first ranking");
  assert.equal(search.match(/if \(availabilityPriority\) return availabilityPriority;/g)?.length, 2);
  assert.ok(search.indexOf("if (availabilityPriority) return availabilityPriority;") < search.indexOf('if (sort === "recommended" && availabilityDemoActive)'), "availability with price must outrank the selected secondary sort");
  assert.match(search, /else setArea\("\u05d4\u05db\u05dc"\)/, "an omitted whole-country location must clear a previously selected area");
  assert.match(search, /selectedExtras, sort, searchQuery\]\)/, "a new date search must clear stale map viewport results");
  assert.match(search, /availability-demo-summary/);
});

test("five additional verified catalog places always show available dates and an illustrative price", () => {
  const addedPlaces = {
    "vacation-hamata-begalil-primium": 1800,
    "vacation-como-boutique": 2200,
    "vacation-villa-exodus": 2600,
    "vacation-tepers-estate": 3200,
    "vacation-daniel": 2800,
  };

  for (const [slug, price] of Object.entries(addedPlaces)) {
    assert.equal(card.match(new RegExp(`"${slug}": "available-price"`, "g"))?.length, 4);
    assert.match(card, new RegExp(`"${slug}": ${price}`));
  }
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

test("availability states always show searched dates while prices and alternatives remain independent", () => {
  assert.match(card, /showSelectedDates: false/);
  for (const price of [700, 1100, 1200, 1300, 1500, 1600, 2400, 4000, 4500, 6000]) assert.match(card, new RegExp(`: ${price}`));
  assert.match(card, /alternativeOffsets = period === 3 \? \[-7, 2\] : \[3, 7\]/);
  assert.match(card, /resolvedAvailability\.alternatives\?\.length/);
  assert.match(card, /copy\.searchedDates/);
  assert.doesNotMatch(card, /resolvedAvailability\.showSelectedDates \?/);
});

test("availability presentation remains compact and responsive", () => {
  assert.match(css, /\.stay-card__date-status-row \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.stay-card__demo-label \{[^}]*font: 800 \.67rem\/1\.25 var\(--font-sans\)/);
  assert.match(css, /\.stay-card__alternatives > div \{[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.stay-card__alternatives small \{[^}]*white-space: normal/);
});
