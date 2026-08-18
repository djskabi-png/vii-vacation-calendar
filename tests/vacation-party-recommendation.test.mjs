import assert from "node:assert/strict";
import test from "node:test";
import { recommendVacationUnits } from "../app/lib/vacation-party-recommendation.mjs";

const hilatInventory = [
  { index: 0, availableCount: 1, maxGuests: 6, totalPrice: 2400, nightlyPrice: 1200 },
  { index: 1, availableCount: 1, maxGuests: 6, totalPrice: 2400, nightlyPrice: 1200 },
  { index: 2, availableCount: 1, maxGuests: 6, totalPrice: 2400, nightlyPrice: 1200 },
  { index: 3, availableCount: 1, maxGuests: 7, totalPrice: 2400, nightlyPrice: 1200 },
];

test("a whole property or one large unit stays one recommendation", () => {
  const result = recommendVacationUnits([{ index: 0, availableCount: 1, maxGuests: 14 }], 4);
  assert.equal(result?.unitCount, 1);
  assert.equal(result?.totalCapacity, 14);
  assert.deepEqual(result?.items.map(({ index, quantity }) => ({ index, quantity })), [{ index: 0, quantity: 1 }]);
});

test("seven guests get the one Hilat cabin that fits", () => {
  const result = recommendVacationUnits(hilatInventory, 7);
  assert.equal(result?.unitCount, 1);
  assert.equal(result?.items[0].index, 3);
  assert.equal(result?.totalPrice, 2400);
});

test("eight guests get two cabins and the real combined price", () => {
  const result = recommendVacationUnits(hilatInventory, 8);
  assert.equal(result?.unitCount, 2);
  assert.equal(result?.totalPrice, 4800);
  assert.equal(result?.nightlyPrice, 2400);
  assert.equal(result?.items.reduce((sum, item) => sum + item.quantity, 0), 2);
});

test("the solver respects available quantities and returns no false fit", () => {
  const result = recommendVacationUnits([{ index: 0, availableCount: 1, maxGuests: 4, totalPrice: 1000 }], 5);
  assert.equal(result, null);
});

test("fewer units win before a cheaper fragmented combination", () => {
  const result = recommendVacationUnits([
    { index: 0, availableCount: 1, maxGuests: 8, totalPrice: 3000 },
    { index: 1, availableCount: 2, maxGuests: 4, totalPrice: 900 },
  ], 8);
  assert.equal(result?.unitCount, 1);
  assert.equal(result?.items[0].index, 0);
});

test("missing prices stay unknown instead of becoming zero", () => {
  const result = recommendVacationUnits([{ index: 0, availableCount: 1, maxGuests: 6 }], 2);
  assert.equal(result?.unitCount, 1);
  assert.equal("totalPrice" in (result || {}), false);
});
