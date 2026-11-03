import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");

test("an unavailable property quote prevents every unit from claiming availability", () => {
  assert.match(business, /overallStayUnavailable = hasSelectedDates && effectiveVacationAvailability\?\.availability === "unavailable"/);
  assert.match(business, /roomAvailable = vacationAvailabilityMode !== "inquiry" && !overallStayUnavailable/);
  assert.match(business, /roomUnavailable = vacationAvailabilityMode !== "inquiry" && \(overallStayUnavailable \|\|/);
});
