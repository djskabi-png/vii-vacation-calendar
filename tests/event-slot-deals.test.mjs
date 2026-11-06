import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { liveSupplierSearch } from "../app/lib/vii-live-search.ts";
import { eventDealDate, eventDealPresets } from "../app/lib/event-deal-dates.ts";
import { eventDealPlaceLabels } from "../app/lib/event-deal-labels.ts";
import { eventOfferHref, eventPlaceHref } from "../app/lib/event-place-href.ts";

test("dedicated last-minute page keeps a truthful browse fallback without claiming availability", () => {
  const source = readFileSync(new URL("../app/components/event-last-minute.tsx", import.meta.url), "utf8");
  assert.match(source, /fallbackTitle/);
  assert.match(source, /fallbackStatus/);
  assert.match(source, /!busy && !candidates\.length && additionalPlaces\.length/);
  assert.doesNotMatch(source, /const additionalPlaces = fixedPreset \? \[\] :/);
  assert.match(source, /className="event-deals__check">\{text\.fallbackStatus\}/);
  assert.doesNotMatch(source, /event-deals__check[^\n]+selectedAvailability/);
});

test("event discovery exposes exactly one truthful result family after a failed live check", () => {
  const source = readFileSync(new URL("../app/components/event-last-minute.tsx", import.meta.url), "utf8");
  assert.match(source, /const showBrowseFallback = Boolean\(!busy && !candidates\.length && additionalPlaces\.length && \(search\.status === "ready" \|\| search\.status === "error"\)\)/);
  assert.match(source, /const visibleAdditionalPlaces = showBrowseFallback \? additionalPlaces : \[\]/);
  assert.match(source, /role=\{showBrowseFallback \? "status" : "alert"\}/);
  assert.match(source, /title=\{showBrowseFallback \? text\.fallbackTitle : title\}/);
});

test("dated event offers preserve their supplier identity instead of joining a second query to a vacation link", () => {
  const place = { slug: "event-4", sourcePropertySlug: "vacation-9" };
  const href = eventOfferHref(place, new URLSearchParams({ from: "2026-10-22", guests: "100", slot: "evening", roomID: "40" }));
  const url = new URL(href, "https://vii.spaplus.co");
  assert.equal(url.pathname, "/events/place/event-4");
  assert.deepEqual(Object.fromEntries(url.searchParams), { from: "2026-10-22", guests: "100", slot: "evening", roomID: "40" });
  assert.equal(eventPlaceHref(place), "/business?id=vacation-9&mode=events");
  const route = readFileSync(new URL("../app/events/place/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(route, /place.sourcePropertySlug && !datedEvent/);
  assert.match(route, /validDate\(selection.from\)/);
});

test("event brand and city labels use verified Latin identities rather than translated dictionary nouns", () => {
  const place = { name: "סטאר לופט", location: "נשר", type: "מקום לאירועים", sourceUrl: "https://www.vii.co.il/events/Star_Loft" };
  const geography = [{ level: "city", title: "נשר", titleEn: "Nesher" }];
  const result = eventDealPlaceLabels(place, "fr", value => value === "נשר" ? "un aigle" : value, geography);
  assert.equal(result.name, "Star Loft");
  assert.equal(result.location, "Nesher");
  assert.equal(eventDealPlaceLabels(place, "fr", () => "un aigle").location, "Israël");
  assert.ok(!/[\u0590-\u05ff]/.test(JSON.stringify(result)));
  assert.equal(eventDealPlaceLabels(place, "he", value => value).name, place.name);
});

test("event slot contract supports large parties without legacy room/adult limits", async () => {
  const calls = [];
  const result = await liveSupplierSearch({ world: "events", from: "2026-10-22", till: "2026-10-22", guests: 100, slot: "evening", token: "fixture", publishedIds: new Set([4]), fetchImpl: async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return Response.json({ sites: [{ siteID: 4, available: true, onlineBooking: true, minPrice: 5500, cheapest: { date: "2026-10-22", slot: "evening", roomID: 40, price: 5500 } }] });
  } });
  assert.deepEqual(calls, [{ date: "2026-10-22", guests: 100, slot: "evening" }]);
  const offer = result.results[0];
  assert.deepEqual([offer.available, offer.total, offer.slot, offer.from, offer.till, offer.start, offer.priceGuests, offer.roomID], [true, 5500, "evening", "2026-10-22", "2026-10-23", "17:00", 100, 40]);
});

test("event offers never turn unknown, mismatched or unapproved records into available deals", async () => {
  const valid = { available: true, minPrice: 3500, cheapest: { date: "2026-10-22", slot: "morning", roomID: 40, price: 3500 } };
  const result = await liveSupplierSearch({ world: "events", from: "2026-10-22", till: "2026-10-22", guests: 20, slot: "morning", token: "fixture", publishedIds: new Set([1, 2, 3, 4, 5, 6]), fetchImpl: async () => Response.json({ sites: [
    { siteID: 1, ...valid },
    { siteID: 2, ...valid, available: null, reason: "no_availability" },
    { siteID: 3, ...valid, cheapest: { ...valid.cheapest, date: "2026-10-23" } },
    { siteID: 4, ...valid, cheapest: { ...valid.cheapest, slot: "evening" } },
    { siteID: 5, ...valid, cheapest: { ...valid.cheapest, price: 3499 } },
    { siteID: 6, ...valid, available: false },
    { siteID: 99, ...valid },
  ] }) });
  assert.deepEqual(result.results.filter(r => r.available === true).map(r => r.siteID), [1]);
  assert.equal(result.results.find(r => r.siteID === 2).reason, "no_availability");
  assert.equal(result.results.find(r => r.siteID === 6).available, false);
  assert.ok(result.results.filter(r => r.available !== true).every(r => r.total === null));
});

test("explicit event availability survives a missing price while unknown no_prices stays unknown", async () => {
  const result = await liveSupplierSearch({ world: "events", from: "2026-11-05", till: "2026-11-05", guests: 20, token: "fixture", publishedIds: new Set([1,2]), fetchImpl: async () => Response.json({ sites: [
    {siteID:1,available:true,minPrice:null,cheapest:{date:"2026-11-05",slot:"morning",roomID:10,price:null}},
    {siteID:2,available:null,reason:"no_prices"},
  ] }) });
  assert.equal(result.results[0].available,true);
  assert.equal(result.results[0].total,null);
  assert.equal(result.results[0].from,"2026-11-05");
  assert.equal(result.results[1].available,null);
  assert.equal(result.results[1].total,null);
});

test("event date presets use Israel date and never repeat a weekday that has started", () => {
  const now = new Date("2026-10-21T22:30:00Z");
  assert.equal(eventDealDate(0, now), "2026-10-22");
  assert.deepEqual(eventDealPresets(now).map(p => p.date), ["2026-10-22", "2026-10-29", "2026-10-23"]);
});

test("both discovery surfaces use real event deals, preserving slot and participant context", () => {
  const slider = readFileSync(new URL("../app/components/event-last-minute.tsx", import.meta.url), "utf8");
  assert.match(slider, /offer\?\.available !== true/);
  assert.match(slider, /slot: offer.slot!/);
  assert.match(slider, /guests: String\(guests\)/);
  assert.match(slider, /search.status === "error"/);
  assert.match(readFileSync(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8"), /<EventLastMinute places=\{eventPlaces\}/);
  assert.match(readFileSync(new URL("../app/events/page.tsx", import.meta.url), "utf8"), /<EventLastMinute places=\{eventLastMinuteProps\(eventPlaces\)\}/);
  assert.match(readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8"), /params.set\("slot", selectedEventSlot\)/);
  assert.match(slider, /const availablePlaces = search\.places \|\| places/);
  assert.match(slider, /search\.resultOrder\.length/);
  assert.match(slider, /uniqueEventVenueItems/);
  const route = readFileSync(new URL("../app/api/vii/live-search/route.ts", import.meta.url), "utf8");
  assert.match(route, /body.includePlaces === true/);
  assert.match(route, /publicCatalogSelectedSummaries<EventDealPlace>\("events", ids\)/);
  assert.doesNotMatch(route, /liveOffers\.slice\(0, 20\)/);
  assert.match(route, /visibleOffers/);
  assert.match(route, /visiblePlaces/);
});

test("event rail keeps only quick date tabs while further event refinement stays in search", () => {
  const slider = readFileSync(new URL("../app/components/event-last-minute.tsx", import.meta.url), "utf8");
  assert.match(slider, /home-live-deals__tabs event-last-minute-tabs/);
  assert.match(slider, /role="tablist"/);
  assert.match(slider, /role="tab"/);
  assert.match(slider, /role="tabpanel"/);
  assert.match(slider, /event\.key === "Home"/);
  assert.match(slider, /layout === "grid" \? <form/);
  assert.doesNotMatch(slider, /type="date"/);
  assert.match(slider, /eventDealPagePath/);
  assert.match(slider, /additionalPlaces[\s\S]*20 - candidates\.length/);
  assert.match(slider, /confirmed\.has\(place\.slug\)/);
  assert.match(slider, /event-deals__card--browse/);
  assert.match(slider, /useStartingPrices\("events", true\)/);
  assert.match(slider, /supplierStartingPrice\(startingPrices\[place\.slug\] \|\| place\)/);
  assert.match(slider, /priority: place => supplierStartingPrice\(startingPrices\[place\.slug\] \?\? place\) \? 0 : 1/);
  assert.match(slider, /<CatalogStartingPrice amount=\{startingPrice\}/);
  assert.match(slider, /showBrowseFallback/);
  assert.match(slider, /className="event-deals__check">\{text\.fallbackStatus\}/);
  assert.match(slider, /today: /);
  assert.match(slider, /tomorrow: /);
  assert.match(slider, /thursday: /);
  assert.match(slider, /friday: /);
  assert.match(slider, /eventPlaceHref\(place\)/);
  assert.match(slider, /busy && !visibleAdditionalPlaces\.length/);
  assert.match(slider, /search\.status === "error"/);
  assert.doesNotMatch(slider, /בדיקת זמינות בעמוד המקום/);
});
