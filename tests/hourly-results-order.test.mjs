import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { orderDiscoveryResults, orderGroupedDiscoveryResults } from "../app/lib/discovery-result-sort.ts";
import { completePlaceSearchResults, nearbySearchRecommendations, PLACE_SEARCH_MINIMUM_RESULTS } from "../app/lib/nearby-recommendations.ts";
import { matchesSearchLocation } from "../app/data/search-taxonomy.ts";

const model = { id: (item) => item.id, name: (item) => item.name, price: (item) => item.price };
const key = (item) => item.id;

function actualResultItems(source, vars, name = "resultItems") {
  const file = ts.createSourceFile("hourly-results.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let arrow;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name) {
      const call = node.initializer;
      arrow = call.arguments[0].getText(file);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(arrow, "resultItems useMemo initializer exists");
  const js = ts.transpileModule(`const __fn = ${arrow};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const context = { ...vars, completePlaceSearchResults, orderDiscoveryResults, orderGroupedDiscoveryResults, nearbySearchRecommendations, PLACE_SEARCH_MINIMUM_RESULTS, matchesSearchLocation };
  vm.createContext(context);
  vm.runInContext(`${js}\nresult = __fn();`, context);
  return context.result;
}

test("hourly component executes its actual resultItems initializer and wires nine-card auto-load", () => {
  const source = fs.readFileSync(new URL("../app/components/hourly-results.tsx", import.meta.url), "utf8");
  assert.match(source, /<ProgressiveResults autoLoad className/);
  const exact = [{ id: "exact", name: "Exact", price: 200 }];
  const nearby = [{ id: "near", name: "Near", price: 50 }];
  assert.deepEqual(actualResultItems(source, { filtered: exact, nearbyRecovery: nearby, sort: "price-asc", documentSeed: "ast", sortModel: model }).map(key), ["exact", "near"]);
});

test("hourly keeps matching city first, then nearby, with numeric price order", () => {
  const exact = [{ id: "city-expensive", name: "Exact expensive", price: 250 }, { id: "city-cheap", name: "Exact cheap", price: 100 }];
  const nearby = [{ id: "near-cheaper", name: "Neighbor cheap", price: 50 }, { id: "city-cheap", name: "Duplicate exact", price: 100 }];
  const result = orderGroupedDiscoveryResults(exact, nearby, "price-asc", "hourly-test", model, key);
  assert.deepEqual(result.map(key), ["city-cheap", "city-expensive", "near-cheaper"]);
  assert.equal(new Set(result.map(key)).size, result.length);
  const oldGlobalSort = orderDiscoveryResults([...exact, ...nearby.filter((item) => item.id !== "city-cheap")], "price-asc", "old", model);
  assert.deepEqual(oldGlobalSort.map(key), ["near-cheaper", "city-cheap", "city-expensive"]);
});

test("hourly nearest sorting stays within the matching-city group", () => {
  const exact = [{ id: "city-far", name: "Far", price: 100, distance: 20 }, { id: "city-near", name: "Near", price: 300, distance: 2 }];
  const nearby = [{ id: "neighbor", name: "Neighbor", price: 1, distance: 0.5 }];
  const nearestModel = { ...model, distance: (item) => item.distance };
  assert.deepEqual(orderGroupedDiscoveryResults(exact, nearby, "nearest", "hourly-nearest", nearestModel, key).map(key), ["city-near", "city-far", "neighbor"]);
});

test("hourly numeric sorting keeps missing prices after priced items in both groups", () => {
  const exact = [{ id: "exact-missing", name: "Missing", price: undefined }, { id: "exact-priced", name: "Priced", price: 300 }];
  const nearby = [{ id: "near-missing", name: "Nearby missing", price: undefined }, { id: "near-priced", name: "Nearby priced", price: 100 }];
  assert.deepEqual(orderGroupedDiscoveryResults(exact, nearby, "price-asc", "hourly-missing", model, key).map(key), ["exact-priced", "exact-missing", "near-priced", "near-missing"]);
});

test("hourly grouped ordering preserves all IDs and does not fabricate an unknown city", () => {
  const exact = [{ id: "only", name: "Only match", price: 200 }];
  assert.deepEqual(orderGroupedDiscoveryResults(exact, [], "price-asc", "hourly-empty", model, key).map(key), ["only"]);
  assert.deepEqual(orderGroupedDiscoveryResults([], [], "recommended", "hourly-unknown", model, key), []);
});

test("recommended unfiltered hourly results preserve the original seeded sorter order without nearby recovery", () => {
  const exact = [{ id: "b", name: "B", price: 2 }, { id: "a", name: "A", price: 1 }, { id: "b", name: "duplicate", price: 2 }];
  assert.deepEqual(orderGroupedDiscoveryResults(exact, [], "recommended", "hourly-stable", model, key).map(key), orderDiscoveryResults([{ id: "b", name: "B", price: 2 }, { id: "a", name: "A", price: 1 }], "recommended", "hourly-stable", model).map(key));
});

test("actual hourly initializer keeps hard-filter eligibility and recommended nearby grouping", () => {
  const source = fs.readFileSync(new URL("../app/components/hourly-results.tsx", import.meta.url), "utf8");
  const common = { description: "", features: ["pool"], area: "מרכז", lat: 32.32, lng: 34.85 };
  const items = [
    { ...common, id: "eligible", name: "Eligible", location: "נתניה", price: 200 },
    { ...common, id: "eligible-near", name: "Eligible neighbor", location: "כפר יונה", price: 100, lng: 34.93 },
    { ...common, id: "excluded-price", name: "Too expensive", location: "נתניה", price: 800 },
    { ...common, id: "excluded-feature", name: "No pool", location: "כפר יונה", price: 1, features: [] },
  ];
  const vars = { items, location: "נתניה", maximumPrice: 250, features: ["pool"], featureFilters: [{ id: "pool", terms: ["pool"] }], twoHourPrice: item => item.price, managedGeography: [], sort: "recommended", documentSeed: "hard-filter", sortModel: model };
  const filtered = actualResultItems(source, vars, "filtered");
  const nearbyRecovery = actualResultItems(source, { ...vars, filtered }, "nearbyRecovery");
  const result = actualResultItems(source, { ...vars, filtered, nearbyRecovery });
  assert.deepEqual(result.map(key), ["eligible", "eligible-near"]);
  assert.equal(new Set(result.map(key)).size, result.length);
});

test("the same actual component scenario rejects the former global-sort initializer", () => {
  const source = fs.readFileSync(new URL("../app/components/hourly-results.tsx", import.meta.url), "utf8");
  const old = source.replace(/orderGroupedDiscoveryResults\(filtered, completePlaceSearchResults\(filtered, nearbyRecovery, \(item\) => item.id\), sort, `\$\{documentSeed\}:hourly-search`, sortModel, \(item\) => item.id\)/,
    'orderDiscoveryResults(completePlaceSearchResults(filtered, nearbyRecovery, (item) => item.id), sort, `${documentSeed}:hourly-search`, sortModel)');
  assert.notEqual(old, source, "old callsite mutation was applied");
  const vars = { filtered: [{ id: "exact", name: "Exact", price: 200 }], nearbyRecovery: [{ id: "near", name: "Near", price: 50 }], sort: "price-asc", documentSeed: "red", sortModel: model };
  assert.deepEqual(actualResultItems(source, vars).map(key), ["exact", "near"]);
  assert.deepEqual(actualResultItems(old, vars).map(key), ["near", "exact"]);
});

test("actual hourly grouping preserves duplicate identity, completion threshold and map/list order", () => {
  const source = fs.readFileSync(new URL("../app/components/hourly-results.tsx", import.meta.url), "utf8");
  const exact = Array.from({ length: PLACE_SEARCH_MINIMUM_RESULTS }, (_, i) => ({ id: `city-${i}`, name: `City ${i}`, price: i + 100 }));
  const nearby = [{ id: "near", name: "Neighbor", price: 1 }];
  const run = filtered => actualResultItems(source, { filtered, nearbyRecovery: nearby, sort: "price-asc", documentSeed: "threshold", sortModel: model });
  assert.deepEqual(run(exact).map(key), exact.map(key), "a complete exact group gains no fallback items");
  const resultItems = run([exact[0], exact[0], exact[1]]);
  assert.deepEqual(resultItems.map(key), ["city-0", "city-1", "near"]);
  for (const mapOpen of [false, true]) {
    const displayed = actualResultItems(source, { resultItems, mapOpen, mapVisibleIds: null }, "displayed");
    assert.deepEqual(displayed.map(key), resultItems.map(key));
  }
  const viewport = actualResultItems(source, { resultItems, mapOpen: true, mapVisibleIds: ["near", "city-1"] }, "displayed");
  assert.deepEqual(Array.from(viewport, key), ["city-1", "near"]);
});
