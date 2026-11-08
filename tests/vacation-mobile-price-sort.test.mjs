import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  compareVacationDisplayedPrices,
  orderVacationResultsByDisplayedPrice,
  vacationCatalogDisplayedPrice,
} from "../app/lib/vacation-price-sort.ts";

const search = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const styles = readEffectiveWorldCss();

test("known displayed prices are monotonic and unknown prices stay last in both directions", () => {
  const inventory = [
    { id: "unknown-a", price: undefined, order: 0 },
    { id: "high", price: 2400, order: 1 },
    { id: "low", price: 650, order: 2 },
    { id: "unknown-b", price: null, order: 3 },
    { id: "middle", price: 1250, order: 4 },
  ];
  const ascending = orderVacationResultsByDisplayedPrice(inventory, "asc", item => item.price, item => item.order);
  const descending = orderVacationResultsByDisplayedPrice(inventory, "desc", item => item.price, item => item.order);

  assert.deepEqual(ascending.map(item => item.id), ["low", "middle", "high", "unknown-a", "unknown-b"]);
  assert.deepEqual(descending.map(item => item.id), ["high", "middle", "low", "unknown-a", "unknown-b"]);
  assert.equal(compareVacationDisplayedPrices(undefined, 650, "desc"), 1);
});

test("the sort price and card price share the same async catalog fallback ladder", () => {
  const inventory = [
    { id: "seasonal-high", price: 900, startPriceWinter: 4800, order: 0 },
    { id: "catalog-middle", price: 5000, startPriceWinter: 700, order: 1 },
    { id: "legacy-low", price: 650, order: 2 },
  ];
  const initialCatalog = {};
  const loadedCatalog = { "catalog-middle": { startPriceSummer: 1250 } };
  const priceFor = catalog => item => vacationCatalogDisplayedPrice(item, catalog[item.id], item.price);

  assert.deepEqual(
    orderVacationResultsByDisplayedPrice(inventory, "desc", priceFor(initialCatalog), item => item.order).map(item => item.id),
    ["seasonal-high", "catalog-middle", "legacy-low"],
  );
  assert.deepEqual(
    orderVacationResultsByDisplayedPrice(inventory, "asc", priceFor(loadedCatalog), item => item.order).map(item => item.id),
    ["legacy-low", "catalog-middle", "seasonal-high"],
  );
  assert.equal(vacationCatalogDisplayedPrice(inventory[0], undefined, inventory[0].price), 4800);
  assert.equal(vacationCatalogDisplayedPrice(inventory[1], loadedCatalog["catalog-middle"], inventory[1].price), 1250);
});

test("vacation search sorts the complete result set by the same displayed-price source", () => {
  const comparator = search.slice(search.indexOf("const compareMatches"), search.indexOf("const shouldPrioritizeOnline"));
  assert.match(search, /const displayedSearchPrice = [\s\S]*quote\?\.priceMode === "stay_total" \? quote\.totalPrice : quote\?\.nightlyPrice/);
  assert.match(search, /vacationCatalogDisplayedPrice\(property, startingPrices\[property\.slug\], property\.price\)/);
  assert.match(search, /compareVacationDisplayedPrices\(displayedSearchPrice\(a\), displayedSearchPrice\(b\)/);
  assert.match(search, /orderVacationResultsByDisplayedPrice\([\s\S]*complete,[\s\S]*displayedSearchPrice/);
  assert.ok(comparator.indexOf('if (sort === "price-asc" || sort === "price-desc")') < comparator.indexOf("if (selectedStay)"));
  assert.match(search, /propertyOrderBySlug, startingPrices, undatedSearch/);
  assert.match(search, /propertyOrderBySlug, sort, startingPrices, nearby\.origin/);
});

test("mobile results expose the direct sort control instead of hiding it", () => {
  assert.match(styles, /\.results-toolbar > \.results-toolbar__sort \{\s*display: grid;/);
  assert.doesNotMatch(styles, /\.results-toolbar > \.results-toolbar__sort \{\s*display: none;/);
  assert.match(styles, /\.results-toolbar \{[\s\S]*?min-height: 52px;[\s\S]*?height: auto;[\s\S]*?margin: 4px 0 14px;/);
});
