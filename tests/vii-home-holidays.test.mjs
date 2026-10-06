import assert from "node:assert/strict";
import { test } from "node:test";
import { getHomeHolidays, getHomeHolidayDeals } from "../app/lib/vii-home-holidays.ts";

const list = { holidays: [
  { holidayID: 114, shown: 1, dateStart: "2026-11-08", dateEnd: "2026-11-09", holidayName: "חג הסיגד", windowSearch: 0 },
  { holidayID: 140, shown: 1, dateStart: "2026-12-04", dateEnd: "2026-12-11", holidayName: "חנוכה", isWindowSearch: 0 },
  { holidayID: 150, shown: 1, dateStart: "2027-01-01", dateEnd: "2027-01-01", holidayName: "יום אחד", windowSearch: 0 },
  { holidayID: 160, shown: 1, dateStart: "2027-02-01", dateEnd: "2027-02-03", holidayName: "חלון", windowSearch: 1 },
  { holidayID: 99, shown: 0, dateStart: "2026-12-01", dateEnd: "2026-12-02", holidayName: "מוסתר" },
  { holidayID: 10, shown: 1, dateStart: "2026-01-01", dateEnd: "2026-01-02", holidayName: "עבר" },
] };

test("holidays keep the supplier window but limit a stay to one or two nights", async () => {
  const holidays = await getHomeHolidays({ token: "test", now: new Date("2026-10-06T12:00:00Z"), fetchImpl: async () => Response.json(list) });
  assert.deepEqual(holidays.map((item) => [item.id, item.from, item.till, item.nights, item.windowSearch]), [
    [114, "2026-11-08", "2026-11-09", 1, false],
    [140, "2026-12-04", "2026-12-11", 2, false],
    [150, "2027-01-01", "2027-01-02", 1, false],
    [160, "2027-02-01", "2027-02-03", 2, true],
  ]);
});

test("holiday deals search a two-night stay across the full supplier holiday window", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/holidays")) return Response.json(list);
    if (url.endsWith("/locations")) return Response.json({});
    if (url.endsWith("/vacations")) return Response.json({ places: [{ siteID: 11, active: true, siteName: "מקום", galleries: [{ pictures: ["/a.jpg"] }] }] });
    assert.deepEqual(JSON.parse(init.body), { window: { from: "2026-12-04", till: "2026-12-11" }, nights: 2, rooms: [{ adults: 2 }] });
    return Response.json({ sites: [
      { siteID: 11, available: true, minTotal: 1400, cheapest: { from: "2026-12-08", till: "2026-12-10", total: 1400 } },
      { siteID: 12, available: true, minTotal: 100, cheapest: { from: "2026-12-04", till: "2026-12-11", total: 100 } },
    ] });
  };
  const result = await getHomeHolidayDeals({ id: 140, token: "test", publicSiteIds: new Set([11]), now: new Date("2026-10-06T12:00:00Z"), fetchImpl });
  assert.deepEqual(result.dates, { from: "2026-12-04", till: "2026-12-06", nights: 2 });
  assert.equal(result.deals[0].from, "2026-12-08");
  assert.equal(result.deals[0].till, "2026-12-10");
  assert.equal(result.deals[0].nights, 2);
  assert.equal(result.deals[0].total, 1400);
  assert.equal(calls.length, 4);
});

test("a selected holiday stay is rechecked by its exact dates", async () => {
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/holidays")) return Response.json(list);
    if (url.endsWith("/locations")) return Response.json({});
    if (url.endsWith("/vacations")) return Response.json({ places: [{ siteID: 11, active: true, siteName: "מקום", galleries: [{ pictures: ["/a.jpg"] }] }] });
    assert.deepEqual(JSON.parse(init.body), { from: "2026-12-08", nights: 2, rooms: [{ adults: 2 }] });
    return Response.json({ sites: [{ siteID: 11, available: true, minTotal: 1450, cheapest: { from: "2026-12-08", till: "2026-12-10", total: 1450 } }] });
  };
  const options = { id: 140, token: "test", publicSiteIds: new Set([11]), now: new Date("2026-10-06T12:00:00Z"), fetchImpl };
  const result = await getHomeHolidayDeals({ ...options, from: "2026-12-08", till: "2026-12-10" });
  assert.deepEqual(result.dates, { from: "2026-12-08", till: "2026-12-10", nights: 2 });
  assert.equal(result.deals[0].total, 1450);
  await assert.rejects(getHomeHolidayDeals({ ...options, from: "2026-12-04", till: "2026-12-11" }), /invalid_stay/);
  await assert.rejects(getHomeHolidayDeals({ ...options, from: "2026-12-10", till: "2026-12-12" }), /invalid_stay/);
  await assert.rejects(getHomeHolidayDeals({ ...options, from: "2026-12-08" }), /invalid_stay/);
});

test("an ongoing holiday uses the remaining dates and a one-night holiday is searchable", async () => {
  const holidays = await getHomeHolidays({ token: "test", now: new Date("2026-12-10T12:00:00Z"), fetchImpl: async () => Response.json(list) });
  assert.deepEqual(holidays.find((item) => item.id === 140), { id: 140, name: "חנוכה", from: "2026-12-10", till: "2026-12-11", nights: 1, windowSearch: false });
  const oneDay = holidays.find((item) => item.id === 150);
  assert.deepEqual([oneDay?.from, oneDay?.till, oneDay?.nights], ["2027-01-01", "2027-01-02", 1]);
});
