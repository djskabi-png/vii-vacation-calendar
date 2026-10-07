import assert from "node:assert/strict";
import { test } from "node:test";
import { assertCatalogCoverage } from "../scripts/sergey-catalog-coverage.mjs";

test("accepts a normal supplier catalog refresh", () => {
  assert.doesNotThrow(() => assertCatalogCoverage({ vacations: 573, events: 127 }, { vacations: 580, events: 127 }));
});

test("stops a supplier event catalog collapse before staging", () => {
  assert.throws(
    () => assertCatalogCoverage({ vacations: 573, events: 127 }, { vacations: 580, events: 2 }),
    /events: active supplier coverage collapsed from 127 to 2; import stopped/,
  );
});

test("rejects missing coverage counts", () => {
  assert.throws(() => assertCatalogCoverage({ vacations: 573, events: 127 }, { vacations: 580 }), /invalid catalog coverage/);
});
