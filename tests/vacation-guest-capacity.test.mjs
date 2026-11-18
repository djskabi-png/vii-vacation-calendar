import assert from "node:assert/strict";
import test from "node:test";
import { matchesVacationGuestCapacity, vacationGuestCapacity } from "../app/lib/vacation-inventory.ts";

test("single supplier unit cannot match a party larger than its real capacity", () => {
  const suiteTohar = { capacityScope: "unit", guests: 2, units: 1 };
  assert.equal(vacationGuestCapacity(suiteTohar), 2);
  assert.equal(matchesVacationGuestCapacity(suiteTohar, 2), true);
  assert.equal(matchesVacationGuestCapacity(suiteTohar, 4), false);
});

test("multi-unit complex can match the combined capacity of its bookable units", () => {
  const complex = {
    capacityScope: "unit",
    guests: 4,
    units: 3,
    roomOptions: [
      { quantity: 2, guests: 4 },
      { quantity: 1, guests: 2 },
    ],
  };
  assert.equal(vacationGuestCapacity(complex), 10);
  assert.equal(matchesVacationGuestCapacity(complex, 10), true);
  assert.equal(matchesVacationGuestCapacity(complex, 11), false);
});

test("whole-place capacity and unknown supplier capacity keep their intended semantics", () => {
  assert.equal(matchesVacationGuestCapacity({ guests: 8 }, 9), false);
  assert.equal(matchesVacationGuestCapacity({ capacityScope: "unit", guests: 0, units: 0 }, 9), true);
});
