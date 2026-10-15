import assert from "node:assert/strict";
import test from "node:test";
import { legacyHolidaySearchPath } from "../app/lib/search-opportunities.ts";

test("holiday discovery routes Hanukkah to its dedicated planning world", () => {
  assert.equal(legacyHolidaySearchPath("חג חנוכה"), "/holidays/hanukkah");
  assert.equal(legacyHolidaySearchPath("חנוכה"), "/holidays/hanukkah");
});
