import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedSupplierIds } from "../app/lib/published-supplier-ids.ts";

function fakeDb(state, ids = [], fail = false) {
  return { prepare(sql) {
    if (fail) throw new Error("database_unavailable");
    return { bind() { return this; }, async first() { return state; },
      async all() { return { results: ids.map((supplierId) => ({ supplierId })) }; } };
  } };
}

test("supplier IDs use the bundled catalog only before the first accepted runtime generation", async () => {
  const fallback = await publishedSupplierIds("vacations", fakeDb(null));
  assert.ok(fallback.has(389));
  const active = await publishedSupplierIds("vacations", fakeDb({ activeRunId: "accepted-1", activeCount: 2 }, [11, 12]));
  assert.deepEqual([...active], [11, 12]);
  assert.equal(active.has(389), false);
});

test("an incomplete accepted generation fails closed while a database outage uses the release-tested bundle", async () => {
  await assert.rejects(publishedSupplierIds("events", fakeDb({ activeRunId: "accepted-1", activeCount: 2 }, [11])),
    /catalog_active_generation_incomplete/);
  const fallback = await publishedSupplierIds("events", fakeDb(null, [], true));
  assert.ok(fallback.size > 0);
});
