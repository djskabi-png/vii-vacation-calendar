import assert from "node:assert/strict";
import test from "node:test";
import { orderEventResults } from "../app/lib/event-discovery-contract.ts";

test("event ordering keeps all rows and ranks verified commercial states", () => {
  const rows = [{ id: 4, available: null }, { id: 2, available: true, price: 450 }, { id: 3, available: false, price: 300 }, { id: 1, available: true }];
  assert.deepEqual(orderEventResults(rows, row => row).map(row => row.id), [2, 1, 3, 4]);
});
