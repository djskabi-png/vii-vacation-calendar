import assert from "node:assert/strict";
import test from "node:test";
import { legacyHolidaySearchPath } from "../app/lib/search-opportunities.ts";

test("approved legacy holiday pages remain the unique destination for holiday discovery", () => {
  assert.equal(legacyHolidaySearchPath("חג חנוכה"), "/search/vacations/israel-137721-7b4fd5d9");
  assert.equal(legacyHolidaySearchPath("חנוכה"), "/search/vacations/israel-137721-7b4fd5d9");
});
