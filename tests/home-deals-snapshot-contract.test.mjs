import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const helper = fs.readFileSync(new URL("../app/lib/home-deals-snapshot.ts", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
const wrapper = fs.readFileSync(new URL("../app/components/home-live-sections-seeded.tsx", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../app/api/vii/home-deals/route.ts", import.meta.url), "utf8");

test("SSR discovery seed is snapshot-only and bounded", () => {
  assert.match(helper, /readCachedDiscovery/);
  assert.doesNotMatch(helper, /refreshVacationDiscoveryPeriod|fetch\s*\(/);
  assert.match(wrapper, /setTimeout\(\(\) => resolve\(null\), 1500\)/);
  assert.match(wrapper, /x-vii-locale/);
});

test("seed cannot cross date, locale, region, period or freshness boundaries", () => {
  assert.match(client, /acceptedHomeDealsSeed\(initialData/);
  assert.match(client, /acceptedHomeDealsSeed\(initialData/);
  assert.match(fs.readFileSync(new URL("../app/lib/home-deals-seed.ts", import.meta.url), "utf8"), /seed\.period !== expected\.period/);
  assert.match(fs.readFileSync(new URL("../app/lib/home-deals-seed.ts", import.meta.url), "utf8"), /seed\.guests !== expected\.guests/);
  assert.match(client, /!clock \|\| eligibleDealDate/);
});

test("API and SSR share preparation without duplicate snapshot read", () => {
  assert.doesNotMatch(api, /readHomeDealsSnapshot\(/);
  assert.match(api, /selectHomeDeals\(/);
  assert.match(api, /cached\.cache\.status === "stale"/);
  assert.match(helper, /priceGuests === guests/);
  assert.match(helper, /publicSummaryIds/);
});
