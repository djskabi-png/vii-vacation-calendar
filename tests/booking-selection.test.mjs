import assert from "node:assert/strict";
import test from "node:test";
import { selectUnitCombination, stayPriceLabel } from "../app/lib/booking-selection.ts";

test("large-party selection uses real units and the requested room count", () => {
  const result = selectUnitCombination([{ roomID: 10, capacity: 4, total: 400 }, { roomID: 11, capacity: 6, total: 500 }, { roomID: 12, capacity: 8, total: 700 }], 13, 2);
  assert.deepEqual(result?.units.map((unit) => unit.roomID), [11, 12]);
  assert.equal(result?.capacity, 14);
  assert.equal(result?.total, 1200);
});

test("insufficient real units fail closed", () => {
  assert.equal(selectUnitCombination([{ roomID: 1, capacity: 10 }], 10, 2), null);
});

test("average per night is omitted for one-night stays", () => {
  assert.deepEqual(stayPriceLabel(950, 1), { total: 950, currency: "₪" });
  assert.deepEqual(stayPriceLabel(1900, 2), { total: 1900, averagePerNight: 950, currency: "₪" });
});
