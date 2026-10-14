import assert from "node:assert/strict";
import test from "node:test";

import catalog from "../app/data/sergey-public-catalog.json" with { type: "json" };
import { publicVacationSearchProperties } from "../app/lib/public-vacation-search.ts";
import { matchesVacationSearchFilter, vacationSearchFilterIds } from "../app/lib/vacation-search-filter-index.ts";

const vacations = catalog.places.filter((place) => place.world === "vacations");

test("vacation search projection preserves filter truth with a bounded payload", () => {
  const projected = publicVacationSearchProperties(vacations);

  assert.equal(projected.length, vacations.length);
  for (let index = 0; index < vacations.length; index += 1) {
    const original = vacations[index];
    const compact = projected[index];
    const expectedFilters = vacationSearchFilterIds(original);
    assert.deepEqual(compact.searchFilterIds, expectedFilters);
    for (const id of expectedFilters) assert.equal(matchesVacationSearchFilter(compact, id), true);
    assert.equal(compact.description, "");
    assert.ok(compact.features.length <= 3);
    assert.ok(compact.images.length <= 5);
    assert.equal(Object.hasOwn(compact.contact || {}, "email"), false);
  }

  const originalBytes = Buffer.byteLength(JSON.stringify(vacations));
  const compactBytes = Buffer.byteLength(JSON.stringify(projected));
  assert.ok(compactBytes < originalBytes * 0.6, `${compactBytes} should be under 60% of ${originalBytes}`);
});
