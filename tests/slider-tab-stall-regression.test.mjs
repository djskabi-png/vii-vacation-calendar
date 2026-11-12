import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const slider = readFileSync(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
const nearRoute = readFileSync(new URL("../app/api/vii/home-deals/route.ts", import.meta.url), "utf8");
const holidayRoute = readFileSync(new URL("../app/api/vii/home-holiday-deals/route.ts", import.meta.url), "utf8");

test("vacation tabs share in-flight requests and prewarm the remaining periods sequentially", () => {
  assert.match(slider, /const periodPrimeRequests = new Map<string, Promise<ResponseData>>\(\)/);
  assert.match(slider, /pendingHomePeriodPrime\(period, language, clock\.key, guests, regionLabel\)/);
  assert.match(slider, /primedHoliday \|\| primedPeriod[\s\S]*waitForHolidayPrime/);
  assert.match(slider, /for \(const item of ordered\)[\s\S]*await primeHomePeriodDeals\(item\.id/);
  assert.match(slider, /await new Promise\(\(resolve\) => setTimeout\(resolve, 150\)\)/);
});

test("cold discovery joins one lease-owned warm operation before returning refreshing", () => {
  for (const route of [nearRoute, holidayRoute]) {
    assert.match(route, /const visitorWarmBudgetMs = 3_200/);
    assert.match(route, /Promise\.race\(\[/);
  }
  assert.match(nearRoute, /const warm = refreshVacationDiscoveryPeriod\(db, requestedPeriod, guests, now\)/);
  assert.match(nearRoute, /getRequestExecutionContext\(\)\?\.waitUntil\(warm/);
  assert.match(holidayRoute, /const refresh = cachedHolidayDiscovery/);
  assert.doesNotMatch(holidayRoute, /setTimeout\(\(\) => resolve\(null\), 1200\)/);
});
