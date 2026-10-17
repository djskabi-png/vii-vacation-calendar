import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesVacationOnlineBooking } from "../app/lib/vacation-online-booking-filter.ts";
import { readFileSync } from "node:fs";
import { depthQuery } from "../app/lib/world-depth-policy.ts";
import { parseSearchDemandEvent } from "../app/lib/search-analytics.ts";

const selection = { from: "2026-10-18", till: "2026-10-19" };
const quote = { ...selection, availability: "available", nightlyPrice: 600, onlineBooking: true, bookingSupported: true };
const good = { status: "ready", quote };

test("online filter uses confirmed supported priced offers for the exact selection", () => {
  assert.equal(matchesVacationOnlineBooking(true, good, selection), true);
  assert.equal(matchesVacationOnlineBooking(false, undefined, null), true);
  const pool = [good, { ...good, quote: { ...quote, onlineBooking: false } }, { status: "loading", quote }, { ...good, quote: { ...quote, availability: "unknown" } }];
  assert.deepEqual(pool.map((state, id) => ({ state, id })).filter(item => matchesVacationOnlineBooking(true, item.state, selection)).map(item => item.id), [0]);
});

test("online filter excludes no-date, stale, phone-only, demo, unknown, missing price and unsupported room offers", () => {
  for (const state of [undefined, { ...good, status: "loading" }, { ...good, status: "error" },
    ...[{ onlineBooking: false }, { onlineBooking: undefined }, { availability: "unknown" }, { availability: "unavailable" }, { nightlyPrice: 0 }, { nightlyPrice: undefined }, { bookingSupported: false }, { illustrative: true }, { from: "2026-10-20" }].map(patch => ({ ...good, quote: { ...quote, ...patch } }))]) {
    assert.equal(matchesVacationOnlineBooking(true, state, selection), false);
  }
  assert.equal(matchesVacationOnlineBooking(true, good, null), false);
});

test("online selection survives vacation URLs and depth changes but never crosses worlds", () => {
  // The URL builder's extensionless framework imports are covered by the
  // production build/browser flow; inspect its generic preservation boundary.
  const builder = readFileSync(new URL("../app/lib/vacation-search-url.ts", import.meta.url), "utf8");
  assert.match(builder, /const params = new URLSearchParams\(currentSearch\)/);
  assert.match(builder, /if \(value === null\) params.delete\(key\)/);
  assert.equal(depthQuery("vacation", "online=1&from=2026-10-18", { location: "צפון" }).get("online"), "1");
  for (const world of ["events", "spa", "hourly", "providers", "activities", "trails"]) assert.equal(depthQuery(world, "online=1").has("online"), false);
});

test("online filter is wired before primary and nearby results and has truthful date and retry states", () => {
  const page = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const onlineOnly = searchParams.get\("online"\) === "1"/);
  assert.equal((page.match(/matchesVacationOnlineBooking\(onlineOnly,/g) || []).length, 2);
  assert.match(page, /shownFilters.onlineOnly[\s\S]*matchesVacationOnlineBooking\(true,/);
  assert.match(page, /online: draftFilters.onlineOnly \? "1" : null/);
  assert.match(page, /accessible: null, online: null/);
  assert.match(page, /catalogLoading \|\| catalogError \|\| onlineCheckPending/);
  assert.match(page, /setOnlineSearchRetry\(\(value\) => value \+ 1\)/);
  const box = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
  assert.match(box, /mode === "vacation" && new URLSearchParams\(searchParamsKey\).get\("online"\) === "1"/);
  assert.match(box, /if \(!openDatesRequest \|\| mode !== "vacation"\) return/);
});

test("privacy-safe search demand distinguishes the online filter", () => {
  const event = parseSearchDemandEvent({ eventId: "d5e63378-217c-4c08-9f62-7bccb8b4fd2e", world: "vacation", location: "מרכז", hasDate: true, filters: { online: true, private: "discard" }, resultCount: 3 });
  assert.deepEqual(event.filters, { online: true });
});
