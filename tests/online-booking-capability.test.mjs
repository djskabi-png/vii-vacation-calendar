import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAPABILITY_FRESH_MS as week, CAPABILITY_MAX_AGE_MS as maxAge, capabilityProbe, fetchCapabilityProbe, mergeCapabilityProbe, hasOnlineCapability, validOnlineCapabilities, publicOnlineCapabilities } from "../app/lib/online-booking-capability.ts";
import { matchesVacationOnlineBooking } from "../app/lib/vacation-online-booking-filter.ts";
import { onlineCapabilitiesResponse } from "../app/api/vii/online-capabilities/route.ts";
const now = Date.parse("2026-10-19T12:00:00Z");

test("undated filter accepts persisted capability but never relaxes dated selection", () => {
  const discovery = { undated: true, capability: { checkedAt: Date.now() } };
  assert.equal(matchesVacationOnlineBooking(true, undefined, null, discovery), true);
  assert.equal(matchesVacationOnlineBooking(true, undefined, null, { undated: false, capability: discovery.capability }), false);
  assert.equal(matchesVacationOnlineBooking(true, undefined, { from: "2026-11-01", till: "2026-11-04" }, discovery), false);
  assert.equal(matchesVacationOnlineBooking(true, undefined, null, { undated: true }), false);
  assert.equal(matchesVacationOnlineBooking(false, undefined, null), true);
});
test("capability carries no probe availability, prices, dates or personal fields", async () => {
  const payload = { sites: [{ siteID: 1, available: false, onlineBooking: true, minTotal: 900, cheapest: { from: "other" }, phone: "private" }] };
  let input;
  const value = await fetchCapabilityProbe("test-token", undefined, now, async (url, init) => {
    assert.equal(url, "https://bizonline.co.il/api/ai/vii/vacations/search");
    assert.equal(init.redirect, "error"); input = JSON.parse(init.body); return Response.json(payload);
  });
  assert.deepEqual(value, { "vacation-1": { checkedAt: now } });
  assert.deepEqual(input, { from: "2026-10-21", nights: 1, rooms: [{ adults: 2 }] });
  assert.deepEqual(input, capabilityProbe(now));
});
test("busy/minimum-stay/omitted/unknown availability does not disable or renew prior capability; explicit false revokes", () => {
  const previous = { "vacation-1": { checkedAt: now - week }, "vacation-2": { checkedAt: now - week }, "vacation-3": { checkedAt: now - week } };
  const result = mergeCapabilityProbe({ sites: [{ siteID: 1, available: false }, { siteID: 2, available: null }, { siteID: 4, onlineBooking: false }] }, previous, now);
  assert.deepEqual(result, previous);
  for (const available of [true, false, null]) assert.deepEqual(mergeCapabilityProbe({ sites: [{ siteID: 1, available, onlineBooking: false }] }, previous, now), { "vacation-2": previous["vacation-2"], "vacation-3": previous["vacation-3"] });
});
test("retention is bounded and malformed or duplicate provider responses are not cached", () => {
  assert.equal(hasOnlineCapability({ checkedAt: now }, now + maxAge - 1), true);
  assert.equal(hasOnlineCapability({ checkedAt: now }, now + maxAge), false);
  assert.equal(hasOnlineCapability({ checkedAt: now + 1 }, now), false);
  for (const payload of [null, {}, { error: "sql", sites: [{ siteID: 1, onlineBooking: true }] }, { sites: [] }, { sites: [{ siteID: 1 }] }, { sites: [{ siteID: 1, onlineBooking: true }, { siteID: 1, onlineBooking: false }] }]) assert.throws(() => mergeCapabilityProbe(payload, {}, now));
  assert.equal(validOnlineCapabilities({ "vacation-1": { checkedAt: now, price: 900 } }), false);
  assert.equal(validOnlineCapabilities({ "event-1": { checkedAt: now } }), false);
  assert.deepEqual(publicOnlineCapabilities({ "vacation-1": { checkedAt: now }, "vacation-2": { checkedAt: now }, "vacation-3": { checkedAt: now - maxAge } }, new Set([1, 3]), now), { "vacation-1": { checkedAt: now } });
});
test("public route filters current publication after cache and rejects parameters/errors", async () => {
  const deps = { read: async () => ({ value: { "vacation-1": { checkedAt: now }, "vacation-2": { checkedAt: now } } }), published: async () => new Set([1]), now: () => now };
  const request = new Request("https://vii.spaplus.co/api/vii/online-capabilities");
  const result = await onlineCapabilitiesResponse(request, deps);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { capabilities: { "vacation-1": { checkedAt: now } } });
  assert.equal((await onlineCapabilitiesResponse(new Request(request.url + "?from=2026-11-01"), deps)).status, 400);
  assert.equal((await onlineCapabilitiesResponse(request, { ...deps, published: async () => { throw Error("down"); } })).status, 503);
});
test("search list, nearby, map, draft and badge share capability without changing price semantics", () => {
  const page = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const undatedSearch = !selectedStay && !hasSearchDate\(searchParams\);/);
  assert.equal((page.match(/onlineCapability=\{undatedSearch && hasOnlineCapability/g) || []).length, 2);
  assert.match(page, /onlineOnly && !matchesOnline\(property\)/);
  assert.match(page, /shownFilters.onlineOnly[^\n]*!matchesOnline\(property\)/);
  assert.doesNotMatch(page, /בחרו תאריכי כניסה ויציאה כדי לראות מקומות שניתן להזמין אונליין/);
  assert.match(page, /const startingPrices = useStartingPrices\("vacations", undatedSearch\);/);
  assert.equal((page.match(/catalogStartingPrices=\{startingPrices\[property\.slug\]\}/g) || []).length, 2);
  assert.match(page, /aria-busy=\{\(undatedSearch \? onlineCapabilities.status : supplierSearch.status\) === "loading"\}/);
  assert.match(page, /onlineOnly && undatedCapabilityUnavailable/);
  assert.match(page, /undatedCapabilityUnavailable[\s\S]*?\? true[\s\S]*?matchesVacationOnlineBooking/);
  assert.match(page, /מוצגים כל המקומות באזור, בלי סימון הזמנה אונליין/);
  const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /scheduled[\s\S]*databaseForEnv\(env\)[\s\S]*ctx.waitUntil\(cachedOnlineCapabilities\(database\)/);
  const route = readFileSync(new URL("../app/api/vii/online-capabilities/route.ts", import.meta.url), "utf8");
  assert.match(route, /readCachedOnlineCapabilities/);
  assert.doesNotMatch(route, /read: async \(\) => cachedOnlineCapabilities/);
  const client = readFileSync(new URL("../app/lib/use-online-capabilities.ts", import.meta.url), "utf8");
  assert.doesNotMatch(client, /setInterval/);
  const mcp = readFileSync(new URL("../app/mcp/route.ts", import.meta.url), "utf8");
  assert.match(mcp, /world === "vacations"[\s\S]*cachedOnlineCapabilities\(db\)/);
  const card = readFileSync(new URL("../app/components/property-card.tsx", import.meta.url), "utf8");
  assert.match(card, /undatedSearch && !promotional && !property.demoOperations\?\.fictional && onlineCapability/);
});
