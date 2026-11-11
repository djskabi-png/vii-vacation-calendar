import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { availableHolidayParts, holidayAudiences, holidayParts, holidaySelection, holidayDealWindow, holidayDealSearchHref, holidayStayPlan } from "../app/lib/holiday-deal-selection.ts";
import { getHomeHolidayDeals } from "../app/lib/vii-home-holidays.ts";
import { holidayForRequestedStay } from "../app/lib/holiday-deal-selection.ts";
import { HOLIDAY_DISCOVERY_POLICY } from '../app/lib/warm-holiday-discovery-cache.ts';
import { VACATION_DISCOVERY_POLICY } from '../app/lib/warm-vacation-discovery-cache.ts';

const holiday = { id: 140, name: "חנוכה", from: "2026-12-04", till: "2026-12-12", nights: 2, windowSearch: true };
const list = { holidays: [{ holidayID: 140, shown: 1, holidayName: "חנוכה", dateStart: holiday.from, dateEnd: holiday.till }] };

function supplier(guests, part, { maxGuests = 30, available = true, wrongDate = false } = {}) {
  const plan = holidayStayPlan(holiday, part);
  return async (url, init) => {
    if (url.endsWith("/holidays")) return Response.json(list);
    if (url.endsWith("/locations")) return Response.json({});
    if (url.endsWith("/vacations")) return Response.json({ places: [{ siteID: 11, active: true, siteName: "מקום לבדיקה", galleries: [{ pictures: ["/a.jpg"] }], rooms: [{ roomID: 31, maxGuests }], contact: { phone: "0501234567" } }] });
    const body = JSON.parse(init.body);
    const query = plan.find((item) => item.dates.nights === body.nights);
    assert.ok(query);
    assert.deepEqual(body, { ...(query.window ? { window: query.window } : { from: query.dates.from }), nights: query.dates.nights, rooms: [{ adults: guests }] });
    return Response.json({ sites: [{ siteID: 11, available, minTotal: 100 * guests, cheapest: { from: wrongDate ? "2027-01-01" : query.dates.from, till: query.dates.till, total: 100 * guests, rooms: [{ roomID: 31 }] } }] });
  };
}
const options = { id: 140, token: "fixture", publicSiteIds: new Set([11]), now: new Date("2026-10-17T12:00:00Z") };

test("holiday audience selection has exactly the requested three parties and safe defaults", () => {
  assert.deepEqual(holidayAudiences.map(({ id, guests }) => [id, guests]), [["family", 6], ["couple", 2], ["group", 20]]);
  assert.deepEqual(holidaySelection(new URLSearchParams("audience=group&part=ending")), { audience: "group", part: "ending" });
  assert.deepEqual(holidaySelection(new URLSearchParams("audience=unknown&part=evil")), { audience: "couple", part: "all" });
  assert.deepEqual(holidaySelection(new URLSearchParams()), { audience: "couple", part: "all" });
});

test("holiday discovery cache uses the same bounded one-hour stale policy as vacation discovery", () => {
  const route = readFileSync(new URL("../app/api/vii/home-holiday-deals/route.ts", import.meta.url), "utf8");
  assert.deepEqual(HOLIDAY_DISCOVERY_POLICY, { freshMs: 5 * 60_000, staleMs: 60 * 60_000 });
  assert.deepEqual(HOLIDAY_DISCOVERY_POLICY, VACATION_DISCOVERY_POLICY);
  assert.match(route, /cachedHolidayDiscovery\(\{/);
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
  assert.match(ui, /holidaySelection\(new URLSearchParams\(globalThis.location.search\), currentHoliday\)/, "back restores the same shared default");
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

test("holiday period controls expose only distinct windows and stale params normalize safely", () => {
  const oneDay = { from: "2026-12-01", till: "2026-12-02", nights: 1 };
  const twoDays = { from: "2026-12-01", till: "2026-12-03", nights: 2 };
  const threeDays = { from: "2026-12-01", till: "2026-12-04", nights: 2 };
  assert.deepEqual(availableHolidayParts(oneDay), ["all"]);
  assert.deepEqual(availableHolidayParts(twoDays), ["all"]);
  assert.deepEqual(availableHolidayParts(threeDays), ["all", "opening", "ending"]);
  assert.deepEqual(availableHolidayParts(holiday), holidayParts);
  assert.deepEqual(holidaySelection(new URLSearchParams("audience=family&part=ending"), oneDay), { audience: "family", part: "all" });
  const ui = readFileSync(new URL("../app/components/holiday-live-deals.tsx", import.meta.url), "utf8");
  assert.match(ui, /requestedPart = url\.searchParams\.get\("part"\)/, "the client must inspect the requested URL state, not only the already-normalized SSR selection");
  assert.match(ui, /requestedPart === normalizedSelection\.part/, "a valid canonical period must remain unchanged");
  assert.match(ui, /history\.replaceState\(null, "",/, "a stale period must be replaced rather than added to browser history");
});

test("the supplier request rejects a period that the holiday cannot contain", async () => {
  const short = { id: 141, name: "סיגד", from: "2026-11-10", till: "2026-11-11", nights: 1, windowSearch: true };
  await assert.rejects(getHomeHolidayDeals({ ...options, id: short.id, holidays: [short], part: "opening" }), /invalid_selection/);
});

test("advanced search uses supported exact dates and preserves party rather than unknown window params", () => {
  for (const audience of holidayAudiences) for (const part of holidayParts) {
    const params = new URL(holidayDealSearchHref(holiday, { audience: audience.id, part }), "https://vii.spaplus.co").searchParams;
    assert.equal(params.get("guests"), String(audience.guests));
    assert.equal((Date.parse(params.get("till")) - Date.parse(params.get("from"))) / 86400000, 2);
    assert.equal(params.get("editSearch"), "dates", "the visible change-search action must open the real date editor");
    assert.equal(params.get("holiday"), String(holiday.id));
    assert.equal(params.get("holidayPart"), part);
    assert.equal(params.has("windowFrom"), false);
  }
});

test("a short holiday includes supplier stays requiring one through four nights and deduplicates by shortest valid stay", async () => {
  const short = { id: 116, name: "סילבסטר", from: "2026-12-31", till: "2027-01-01", nights: 1, windowSearch: false };
  const places = Array.from({ length: 6 }, (_, index) => ({ siteID: index + 1, active: true, siteName: `מקום ${index + 1}`, galleries: [{ pictures: [`/${index + 1}.jpg`] }], rooms: [{ roomID: 100 + index, maxGuests: 2 }] }));
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/locations")) return Response.json({});
    if (url.endsWith("/vacations")) return Response.json({ places });
    const body = JSON.parse(init.body);
    const till = new Date(Date.parse("2026-12-31T00:00:00Z") + body.nights * 86_400_000).toISOString().slice(0, 10);
    return Response.json({ sites: [
      { siteID: body.nights, available: true, minTotal: body.nights * 500, cheapest: { from: "2026-12-31", till, total: body.nights * 500, rooms: [{ roomID: 99 + body.nights }] } },
      { siteID: 5, available: true, minTotal: body.nights * 600, cheapest: { from: "2026-12-31", till, total: body.nights * 600, rooms: [{ roomID: 104 }] } },
      { siteID: 6, available: false, minTotal: null, cheapest: {} },
    ] });
  };
  const result = await getHomeHolidayDeals({ id: short.id, holidays: [short], token: "fixture", publicSiteIds: new Set(places.map((place) => place.siteID)), guests: 2, fetchImpl });
  assert.deepEqual(result.deals.map((deal) => [deal.siteID, deal.nights, deal.from, deal.till]), [
    [1, 1, "2026-12-31", "2027-01-01"],
    [5, 1, "2026-12-31", "2027-01-01"],
    [2, 2, "2026-12-31", "2027-01-02"],
    [3, 3, "2026-12-31", "2027-01-03"],
    [4, 4, "2026-12-31", "2027-01-04"],
  ]);
  assert.deepEqual(result.stayPlan, { minNights: 1, maxNights: 4 });
});

test("holiday change-search handoff opens the real date editor after hydration without a second navigation", () => {
  const search = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
  const searchBox = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
  const liveSearch = readFileSync(new URL("../app/components/use-vii-live-search.ts", import.meta.url), "utf8");
  assert.match(searchBox, /new URLSearchParams\(window\.location\.search\)\.get\("editSearch"\) !== "dates"/);
  assert.match(searchBox, /handledEditSearchRef\.current = true;[\s\S]*setCalendarOpen\(true\)/);
  assert.match(searchBox, /const \[calendarOpen, setCalendarOpen\] = useState\(false\)/);
  assert.doesNotMatch(searchBox, /leaveMobileEditor\(desktop\)/, "desktop hydration must not immediately close the requested date editor");
  assert.match(search, /const \[openDatesRequest, setOpenDatesRequest\] = useState\(0\)/);
  assert.doesNotMatch(search, /canonicalParams\.delete\("editSearch"\)/, "the editor intent must survive the initial mount");
  assert.doesNotMatch(search, /history\.replaceState/, "URL cleanup must not remount and immediately close the editor");
  assert.match(search, /useViiHolidayLiveSearch\(explicitHolidaySearchId, guests, holidayPart, onlineSearchRetry, inferredHolidayCandidate\)/);
  assert.match(search, /holidayDetectionPending/);
  assert.match(search, /holidayTransitionPending/);
  assert.match(search, /className="holiday-search-loading"/);
  assert.match(search, /!holidayTransitionPending && resultSet\.length > filtered\.length/);
  assert.match(search, /!holidayTransitionPending && !mapOpen && <ProgressiveResults/);
  assert.match(search, /מוצגת לכל מקום השהייה הקצרה ביותר שהספק אישר/);
  assert.match(liveSearch, /home-holiday-deals/);
  assert.match(liveSearch, /matchFrom: candidate\.from, matchTill: candidate\.till/);
  assert.match(liveSearch, /staleWhileRevalidate: false/);
  assert.match(liveSearch, /response\.availabilityStatus === "refreshing"/);
  assert.doesNotMatch(liveSearch, /home-holidays\?all=1/, "direct search must resolve the holiday and its offers atomically");
  assert.match(liveSearch, /deal\.nights > 1 \? "nightly_average" : "stay_total"/);
});

test("holiday transition loader is branded, responsive, and motion-safe", () => {
  const source = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /\.holiday-search-loading \{/);
  assert.match(source, /@keyframes holiday-search-pulse/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});

test("direct holiday detection and the multi-night snapshot resolve atomically without a stale one-night phase", () => {
  const route = readFileSync(new URL("../app/api/vii/home-holiday-deals/route.ts", import.meta.url), "utf8");
  const liveSearch = readFileSync(new URL("../app/components/use-vii-live-search.ts", import.meta.url), "utf8");
  assert.match(route, /holidayForRequestedStay\(holidays, \{ from: matchFrom!, till: matchTill! \}\)/);
  assert.match(route, /const id = holiday\.id/);
  assert.match(liveSearch, /status: "loading", holidayId: response\.holiday\.id/);
  assert.match(liveSearch, /matchedHoliday \? "error" : "ready"/);
  assert.doesNotMatch(liveSearch, /holiday-search-match/, "a stale calendar cache must never release the ordinary one-night search");
});

test("a direct exact URL at a supplier holiday start is promoted to the flexible holiday search", () => {
  const holidays = [
    { id: 116, name: "סילבסטר", from: "2026-12-31", till: "2027-01-01" },
    { id: 140, name: "חנוכה", from: "2026-12-04", till: "2026-12-11" },
  ];
  assert.equal(holidayForRequestedStay(holidays, { from: "2026-12-31", till: "2027-01-01" })?.id, 116);
  assert.equal(holidayForRequestedStay(holidays, { from: "2026-12-04", till: "2026-12-06" })?.id, 140);
  assert.equal(holidayForRequestedStay(holidays, { from: "2026-12-05", till: "2026-12-06" }), null, "a normal exact search inside a holiday must remain exact");
  assert.equal(holidayForRequestedStay(holidays, { from: "2026-12-04", till: "2026-12-12" }), null, "the requested stay must stay inside the supplier holiday window");
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
