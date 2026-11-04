import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");

test("an unavailable property quote prevents every unit from claiming availability", () => {
  assert.match(business, /overallStayUnavailable = hasSelectedDates && effectiveVacationAvailability\?\.availability === "unavailable"/);
  assert.match(business, /roomAvailable = vacationAvailabilityMode !== "inquiry" && !overallStayUnavailable/);
  assert.match(business, /roomUnavailable = vacationAvailabilityMode !== "inquiry" && \(overallStayUnavailable \|\|/);
  assert.match(business, /roomStatus = vacationAvailabilityMode === "inquiry"[\s\S]*?: overallStayUnavailable\s+\? unitCopy\.unavailable/);
});

test("supplier quote transitions use a neutral checking state instead of a false inquiry state", () => {
  assert.match(business, /supplierQuoteUnsettled = Boolean\(supplierSiteID && hasSelectedDates && \(supplierQuote\.status === "loading" \|\| supplierQuote\.status === "error"\)\)/);
  assert.match(business, /property\.onlineAvailability !== false \|\| hasVerifiedSupplierQuote \|\| supplierQuoteUnsettled/);
  assert.match(business, /supplierQuote\.status === "loading" \|\| supplierUnitQuotes\.status === "loading"/);
});
