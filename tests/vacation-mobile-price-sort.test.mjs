import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  compareVacationDisplayedPrices,
  orderVacationResultsByDisplayedPrice,
} from "../app/lib/vacation-price-sort.ts";

const search = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

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

test("vacation search sorts the complete result set by the same displayed-price source", () => {
  const comparator = search.slice(search.indexOf("const compareMatches"), search.indexOf("const shouldPrioritizeOnline"));
  assert.match(search, /const displayedSearchPrice = [\s\S]*quote\?\.priceMode === "stay_total" \? quote\.totalPrice : quote\?\.nightlyPrice/);
  assert.match(search, /compareVacationDisplayedPrices\(displayedSearchPrice\(a\), displayedSearchPrice\(b\)/);
  assert.match(search, /orderVacationResultsByDisplayedPrice\([\s\S]*complete,[\s\S]*displayedSearchPrice/);
  assert.ok(comparator.indexOf('if (sort === "price-asc" || sort === "price-desc")') < comparator.indexOf("if (selectedStay)"));
  assert.match(search, /propertyOrderBySlug, startingPrices, undatedSearch/);
  assert.match(search, /\[filtered, nearbyRecovery, propertyOrderBySlug, sort, startingPrices\]\);/);
});

test("mobile results expose the direct sort control instead of hiding it", () => {
  assert.match(styles, /\.results-toolbar > \.results-toolbar__sort \{\s*display: grid;/);
  assert.doesNotMatch(styles, /\.results-toolbar > \.results-toolbar__sort \{\s*display: none;/);
  assert.match(styles, /\.results-toolbar \{[\s\S]*?min-height: 52px;[\s\S]*?height: auto;[\s\S]*?margin: 4px 0 14px;/);
});
