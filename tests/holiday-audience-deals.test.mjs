import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { holidayAudiences, holidayParts, holidaySelection, holidayDealWindow, holidayDealSearchHref } from "../app/lib/holiday-deal-selection.ts";
import { getHomeHolidayDeals } from "../app/lib/vii-home-holidays.ts";

const holiday = { id: 140, name: "חנוכה", from: "2026-12-04", till: "2026-12-12", nights: 2, windowSearch: true };
const list = { holidays: [{ holidayID: 140, shown: 1, holidayName: "חנוכה", dateStart: holiday.from, dateEnd: holiday.till }] };

function supplier(guests, part, { maxGuests = 30, available = true, wrongDate = false } = {}) {
  const window = holidayDealWindow(holiday, part);
  const till = new Date(Date.parse(window.from) + 2 * 86400000).toISOString().slice(0, 10);
  return async (url, init) => {
    if (url.endsWith("/holidays")) return Response.json(list);
    if (url.endsWith("/locations")) return Response.json({});
    if (url.endsWith("/vacations")) return Response.json({ places: [{ siteID: 11, active: true, siteName: "מקום לבדיקה", galleries: [{ pictures: ["/a.jpg"] }], rooms: [{ roomID: 31, maxGuests }], contact: { phone: "0501234567" } }] });
    assert.deepEqual(JSON.parse(init.body), { window: { from: window.from, till: window.till }, nights: 2, rooms: [{ adults: guests }] });
    return Response.json({ sites: [{ siteID: 11, available, minTotal: 100 * guests, cheapest: { from: wrongDate ? "2027-01-01" : window.from, till, total: 100 * guests, rooms: [{ roomID: 31 }] } }] });
  };
}
const options = { id: 140, token: "fixture", publicSiteIds: new Set([11]), now: new Date("2026-10-17T12:00:00Z") };

test("holiday audience selection has exactly the requested three parties and safe defaults", () => {
  assert.deepEqual(holidayAudiences.map(({ id, guests }) => [id, guests]), [["family", 6], ["couple", 2], ["group", 20]]);
  assert.deepEqual(holidaySelection(new URLSearchParams("audience=group&part=ending")), { audience: "group", part: "ending" });
  assert.deepEqual(holidaySelection(new URLSearchParams("audience=unknown&part=evil")), { audience: "couple", part: "all" });
  assert.deepEqual(holidaySelection(new URLSearchParams()), { audience: "couple", part: "all" });
});

test("every holiday entry defaults to two guests without replacing explicit audience or period intent", () => {
  for (const part of holidayParts) {
    for (const raw of ["", "audience=", "audience=unknown", "audience=Family"]) {
      const selection = holidaySelection(new URLSearchParams(`${raw}&part=${part}`));
      assert.deepEqual(selection, { audience: "couple", part });
      const params = new URL(holidayDealSearchHref(holiday, selection), "https://vii.spaplus.co").searchParams;
      assert.equal(params.get("guests"), "2");
    }
    for (const { id, guests } of holidayAudiences) {
      const selection = holidaySelection(new URLSearchParams({ audience: id, part }));
      assert.deepEqual(selection, { audience: id, part });
      assert.equal(new URL(holidayDealSearchHref(holiday, selection), "https://vii.spaplus.co").searchParams.get("guests"), String(guests));
    }
  }
  const page = readFileSync(new URL("../app/holidays/[slug]/page.tsx", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../app/components/holiday-live-deals.tsx", import.meta.url), "utf8");
  assert.match(page, /const selection = holidaySelection\(/, "every holiday slug resolves SSR selection with the shared default");
  assert.match(ui, /setSelection\(holidaySelection\(new URLSearchParams\(globalThis.location.search\)\)\)/, "back restores the same shared default");
  assert.match(ui, /guests: String\(guests\)/, "request uses selected audience guest count");
});

test("all parties and holiday periods send matching live guest requests and return that price basis", async () => {
  for (const { guests } of holidayAudiences) for (const part of holidayParts) {
    const result = await getHomeHolidayDeals({ ...options, guests, part, fetchImpl: supplier(guests, part) });
    assert.equal(result.deals.length, 1);
    assert.equal(result.deals[0].priceGuests, guests);
    assert.equal(result.deals[0].total, guests * 100);
    assert.equal(result.deals[0].whatsapp, undefined, "call-only number must not become WhatsApp");
  }
});

test("unknown guests, parts, conflicting exact stay and out-of-window selections fail closed", async () => {
  for (const guests of [0, 1, 3, 6.5, 21, NaN, Infinity]) await assert.rejects(getHomeHolidayDeals({ ...options, guests }), /invalid_selection/);
  await assert.rejects(getHomeHolidayDeals({ ...options, part: "invalid" }), /invalid_selection/);
  await assert.rejects(getHomeHolidayDeals({ ...options, part: "ending", from: holiday.from, till: "2026-12-06" }), /invalid_stay/);
  await assert.rejects(getHomeHolidayDeals({ ...options, from: "2026-12-11", till: "2026-12-13", fetchImpl: async () => Response.json(list) }), /invalid_stay/);
});

test("explicit unavailability, impossible room capacity and mismatched dates never become audience deals", async () => {
  for (const scenario of [{ available: false }, { maxGuests: 2 }, { wrongDate: true }]) {
    const result = await getHomeHolidayDeals({ ...options, guests: 20, part: "all", fetchImpl: supplier(20, "all", scenario) });
    assert.deepEqual(result.deals, []);
  }
});

test("short holiday windows never escape their boundaries", () => {
  for (const duration of [1, 2, 3, 8, 30]) for (const part of holidayParts) {
    const tiny = { from: "2026-12-01", till: `2026-12-${String(1 + duration).padStart(2, "0")}`, nights: Math.min(2, duration) };
    const result = holidayDealWindow(tiny, part);
    assert.ok(result.from >= tiny.from && result.till <= tiny.till && result.from < result.till);
  }
});

test("advanced search uses supported exact dates and preserves party rather than unknown window params", () => {
  for (const audience of holidayAudiences) for (const part of holidayParts) {
    const params = new URL(holidayDealSearchHref(holiday, { audience: audience.id, part }), "https://vii.spaplus.co").searchParams;
    assert.equal(params.get("guests"), String(audience.guests));
    assert.equal((Date.parse(params.get("till")) - Date.parse(params.get("from"))) / 86400000, 2);
    assert.equal(params.has("windowFrom"), false);
  }
});

test("holiday UI replaces banners, carries complete quote context and guards late responses", () => {
  const page = readFileSync(new URL("../app/holidays/[slug]/page.tsx", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../app/components/holiday-live-deals.tsx", import.meta.url), "utf8");
  const card = readFileSync(new URL("../app/components/property-card.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /holiday-search-card|holiday-searches__grid/);
  assert.match(ui, /role="tablist"/);
  assert.match(ui, /role="tab"/);
  assert.match(ui, /controller\.signal\.aborted/);
  assert.match(ui, /request === generation\.current/);
  assert.match(ui, /result\.key === key/);
  assert.match(ui, /popstate/);
  assert.match(ui, /priceGuests !== guests/);
  assert.match(ui, /guests: String\(deal\.priceGuests\)/);
  assert.match(ui, /source: "home-holidays"/, "retain the existing holiday detail recheck contract");
  assert.match(card, /initialTill=\{selectedStay\?\.till\}/);
  assert.match(card, /initialGuests=\{selectedStay\?\.guests\}/);
});
