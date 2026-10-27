import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("the accepted runtime identity state filters withdrawals and QQQAAA guards parity", async () => {
  const [source, catalog, accepted, qqqaaa, audit] = await Promise.all([
    readFile(new URL("../app/lib/public-catalog-read.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/sergey-public-catalog.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/data/accepted-runtime-catalog-state.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../scripts/run-qqqaaa.cjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/audit-catalog-fallback-parity.mjs", import.meta.url), "utf8"),
  ]);
  const keys = catalog.places.map((entry) => `${entry.world}:${entry.supplierId}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(accepted.worlds.vacations.ids.includes(2705));
  assert.match(source, /activeIds\.has\(place\.supplierId\)/);
  assert.doesNotMatch(source, /accepted\.additions\.filter/);
  assert.match(audit, /accepted public IDs missing from the emergency snapshot/);
  assert.match(audit, /withdrawn public IDs remain in the emergency snapshot/);
  assert.match(qqqaaa, /catalog-fallback-parity/);
});
