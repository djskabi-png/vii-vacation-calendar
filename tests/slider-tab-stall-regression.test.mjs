import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const slider = readFileSync(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
const nearRoute = readFileSync(new URL("../app/api/vii/home-deals/route.ts", import.meta.url), "utf8");
const holidayRoute = readFileSync(new URL("../app/api/vii/home-holiday-deals/route.ts", import.meta.url), "utf8");

test("visitor tab choices adopt one bounded prime and remaining periods warm sequentially", () => {
  assert.match(slider, /const periodPrimeRequests = new Map<string, PrimeRequest>\(\)/);
  assert.doesNotMatch(slider, /cancelPendingHomePeriodPrime/);
  assert.doesNotMatch(slider, /Selected tab superseded background priming/);
  assert.match(slider, /const request = mode === "holidays" && selectedHoliday[\s\S]*primeHomeHolidayDeals\(selectedHoliday, clock\.key, waitBudgetMs\)[\s\S]*primeHomePeriodDeals\(period, language, clock\.key, guests, regionLabel, waitBudgetMs\)/);
  assert.match(slider, /for \(const item of ordered\.slice\(0, backgroundPrimeLimit\)\)[\s\S]*enqueueBackgroundPrime/);
  assert.match(slider, /await new Promise\(\(resolve\) => setTimeout\(resolve, 150\)\)/);
});

test("cold discovery returns a quick observation while one lease-owned warm operation continues", () => {
  for (const route of [nearRoute, holidayRoute]) {
    assert.match(route, /const visitorWarmBudgetMs = 350/);
    assert.match(route, /Promise\.race\(\[/);
  }
  assert.match(nearRoute, /const warm = refreshVacationDiscoveryPeriod\(db, requestedPeriod, guests, now\)/);
  assert.match(nearRoute, /getRequestExecutionContext\(\)\?\.waitUntil\(warm/);
  assert.match(holidayRoute, /const refresh = cachedHolidayDiscovery/);
  assert.doesNotMatch(holidayRoute, /setTimeout\(\(\) => resolve\(null\), 1200\)/);
});

test("slider discovery observes the server-owned refresh inside one short browser attempt", () => {
  assert.match(slider, /const sliderRequestBudgetMs = 2_500;/);
  assert.doesNotMatch(slider, /totalTimeoutMs:\s*8_000/);
  const sliderRequests = [...slider.matchAll(/totalTimeoutMs:\s*waitBudgetMs,\s*retries:\s*(\d+)/g)];
  assert.ok(sliderRequests.length >= 2, "period and holiday primes must share the bounded one-attempt policy");
  assert.ok(sliderRequests.every((match) => match[1] === "0"));
  assert.match(slider, /\.catch\(\(\) => \{ if \(!controller\.signal\.aborted\) recover\(\); \}\)/);
  assert.ok(350 < 2_500, "the origin observation must settle before the browser transport budget");
});

test("background priming yields to visitor tab changes and stays bounded", () => {
  assert.match(slider, /const backgroundPrimeDelayMs = 800;/);
  assert.match(slider, /const backgroundPrimeLimit = 4;/);
  assert.match(slider, /let backgroundPrimeTail: Promise<void> = Promise\.resolve\(\)/);
  assert.match(slider, /connection\?\.saveData !== true/);
  assert.match(slider, /connection\?\.effectiveType !== "2g"/);
  assert.equal((slider.match(/ordered\.slice\(0, backgroundPrimeLimit\)/g) || []).length, 2);
  assert.equal((slider.match(/\}, backgroundPrimeDelayMs\);/g) || []).length, 2);
  assert.equal((slider.match(/enqueueBackgroundPrime/g) || []).length, 3);
});
