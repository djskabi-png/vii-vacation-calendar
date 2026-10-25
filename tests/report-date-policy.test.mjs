import assert from "node:assert/strict";
import test from "node:test";
import { isClosedReportPeriod, israelDay } from "../app/lib/report-date-policy.ts";

test("report day policy follows Israel midnight", () => {
  const now = new Date("2026-10-24T21:30:00.000Z");
  assert.equal(israelDay(now), "2026-10-25");
  assert.equal(isClosedReportPeriod("2026-10-24", now), true);
  assert.equal(isClosedReportPeriod("2026-10-25", now), false);
});
