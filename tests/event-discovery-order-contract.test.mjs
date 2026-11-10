import assert from "node:assert/strict";
import test from "node:test";
import { orderEventResults } from "../app/lib/event-discovery-contract.ts";

test("event ordering keeps all rows and ranks verified commercial states", () => {
  const rows = [{ id: 5, available: false, price: 300 }, { id: 4, available: null }, { id: 9, available: true, price: 500 }, { id: 3, available: null, price: 250 }, { id: 2, available: true, price: 450 }, { id: 1, available: true }];
  assert.deepEqual(orderEventResults(rows, row => row).map(row => row.id), [9, 2, 1, 3, 4, 5]);
});
