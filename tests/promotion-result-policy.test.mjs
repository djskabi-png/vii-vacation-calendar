import assert from "node:assert/strict";
import test from "node:test";
import { matchingPromotions, turboOrder } from "../app/lib/promotion-result-policy.ts";

const promotions = [
  { world: "vacations", supplierId: 2, weight: 5, featured: true, turboEligible: true },
  { world: "vacations", supplierId: 3, weight: 2, featured: false, turboEligible: false },
  { world: "events", supplierId: 2, weight: 5, featured: true, turboEligible: true },
];
const items = [1, 2, 3, 4].map(id => ({ id: `vacation-${id}`, name: `Place ${id}` }));

test("featured membership is exact-world and post-filter", () => {
  assert.deepEqual(matchingPromotions(items, "vacations", promotions, item => item.id !== "vacation-4").map(item => item.id), ["vacation-2"]);
  assert.deepEqual(matchingPromotions([{id:"event-2"}], "events", promotions, () => true).map(item => item.id), ["event-2"]);
});

test("Turbo is undated-recommended only and explicit sort remains untouched", () => {
  assert.deepEqual(turboOrder(items, "vacations", promotions, true, item => item.id).map(item => item.id), ["vacation-2", "vacation-1", "vacation-3", "vacation-4"]);
  assert.deepEqual(turboOrder(items, "vacations", promotions, false, item => item.id), items);
  assert.deepEqual(turboOrder([{id:"vacation-3"},{id:"vacation-2"}], "vacations", promotions, true, item => item.id, item => item.id === "vacation-3" ? 0 : 1).map(item => item.id), ["vacation-3", "vacation-2"]);
});
