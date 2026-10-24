import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function loadTsModule(relativePath) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)((name) => {
    if (name === "./discovery-slider-order") {
      const { discoverySeedCompare } = loadTsModule("app/lib/discovery-slider-order.ts");
      return { discoverySeedCompare };
    }
    return {};
  }, module, module.exports);
  return module.exports;
}

const { orderDiscoveryResults, discoverySortOptions } = loadTsModule("app/lib/discovery-result-sort.ts");
const model = { id: item => item.id, name: item => item.name, price: item => item.price, rating: item => item.rating, popularity: item => item.reviews, priority: item => item.priority };
const items = [
  { id: "a", name: "Alpha", price: 500, rating: 8.8, reviews: 14, priority: 1 },
  { id: "b", name: "Beta", price: 200, rating: 9.7, reviews: 4, priority: 1 },
  { id: "c", name: "Charlie", rating: undefined, reviews: undefined, priority: 1 },
  { id: "d", name: "Delta", price: 900, rating: 9.1, reviews: 22, priority: 1 },
];

test("default discovery order is stable for one document and rotates for a fresh document", () => {
  const first = orderDiscoveryResults(items, "recommended", "document-one", model).map(item => item.id);
  const repeat = orderDiscoveryResults(items, "recommended", "document-one", model).map(item => item.id);
  const refreshed = orderDiscoveryResults(items, "recommended", "document-two", model).map(item => item.id);
  assert.deepEqual(first, repeat);
  assert.notDeepEqual(first, refreshed);
});

test("explicit numeric sorts are truthful and keep unknown values last", () => {
  assert.deepEqual(orderDiscoveryResults(items, "price-asc", "seed", model).map(item => item.id), ["b", "a", "d", "c"]);
  assert.deepEqual(orderDiscoveryResults(items, "price-desc", "seed", model).map(item => item.id), ["d", "a", "b", "c"]);
  assert.deepEqual(orderDiscoveryResults(items, "rating-desc", "seed", model).map(item => item.id), ["b", "d", "a", "c"]);
  assert.deepEqual(orderDiscoveryResults(items, "popular", "seed", model).map(item => item.id), ["d", "a", "b", "c"]);
});

test("sort options only expose signals present in the inventory", () => {
  const rich = discoverySortOptions(items, model, "he").map(option => option.value);
  assert.deepEqual(rich, ["recommended", "popular", "price-asc", "price-desc", "rating-desc", "name"]);
  const sparse = discoverySortOptions(items.map(({ id, name }) => ({ id, name })), { id: item => item.id, name: item => item.name }, "he").map(option => option.value);
  assert.deepEqual(sparse, ["recommended", "name"]);
});

test("every DiscoveryItem result family imports the shared truthful sort model", () => {
  for (const path of [
    "app/components/hourly-results.tsx",
    "app/attractions/attractions-explorer.tsx",
    "app/components/world-map-results.tsx",
    "app/components/provider-results.tsx",
    "app/trails/trails-explorer.tsx",
  ]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /orderDiscoveryResults/, path);
    assert.match(source, /useDocumentSeed/, path);
    assert.match(source, /discoverySortOptions/, path);
  }
});
