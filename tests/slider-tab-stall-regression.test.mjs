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
  assert.match(slider, /for \(const item of ordered\.slice\(0, backgroundPrimeLimit\)\)[\s\S]*await primeHomePeriodDeals\(item\.id/);
  assert.match(slider, /await new Promise\(\(resolve\) => setTimeout\(resolve, 150\)\)/);
});

test("cold discovery joins one lease-owned warm operation before returning refreshing", () => {
  for (const route of [nearRoute, holidayRoute]) {
    assert.match(route, /const visitorWarmBudgetMs = 4_800/);
    assert.match(route, /Promise\.race\(\[/);
  }
  assert.match(nearRoute, /const warm = refreshVacationDiscoveryPeriod\(db, requestedPeriod, guests, now\)/);
  assert.match(nearRoute, /getRequestExecutionContext\(\)\?\.waitUntil\(warm/);
  assert.match(holidayRoute, /const refresh = cachedHolidayDiscovery/);
  assert.doesNotMatch(holidayRoute, /setTimeout\(\(\) => resolve\(null\), 1200\)/);
});

test("slider discovery never serializes a second browser attempt behind a cold tab click", () => {
  assert.match(slider, /const sliderRequestBudgetMs = 5_500;/);
  assert.doesNotMatch(slider, /totalTimeoutMs:\s*8_000/);
  const sliderRequests = [...slider.matchAll(/totalTimeoutMs:\s*sliderRequestBudgetMs,\s*retries:\s*(\d+)/g)];
  assert.ok(sliderRequests.length >= 2, "period and holiday primes must share the bounded one-attempt policy");
  assert.ok(sliderRequests.every((match) => match[1] === "0"));
  assert.match(slider, /totalTimeoutMs:\s*Math\.min\(5_500, remainingBudget\(\)\),\s*retries:\s*0/);
});

test("background priming yields to visitor tab changes and stays bounded", () => {
  assert.match(slider, /const backgroundPrimeDelayMs = 5_000;/);
  assert.match(slider, /const backgroundPrimeLimit = 2;/);
  assert.equal((slider.match(/ordered\.slice\(0, backgroundPrimeLimit\)/g) || []).length, 2);
  assert.equal((slider.match(/\}, backgroundPrimeDelayMs\);/g) || []).length, 2);
});
