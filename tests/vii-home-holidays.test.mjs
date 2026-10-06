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

test("holidays use supplier dates, include every future shown holiday, and support both field names", async () => {
  const holidays = await getHomeHolidays({ token: "test", now: new Date("2026-10-06T12:00:00Z"), fetchImpl: async () => Response.json(list) });
  assert.deepEqual(holidays.map((item) => [item.id, item.nights, item.windowSearch]), [[114, 1, false], [140, 7, false], [150, 1, false], [160, 2, true]]);
});

test("holiday deals search the exact holiday stay and never invent unavailable listings", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/holidays")) return Response.json(list);
    if (url.endsWith("/locations")) return Response.json({});
    if (url.endsWith("/vacations")) return Response.json({ places: [{ siteID: 11, active: true, siteName: "מקום", galleries: [{ pictures: ["/a.jpg"] }] }] });
    assert.deepEqual(JSON.parse(init.body), { from: "2026-12-04", nights: 7, rooms: [{ adults: 2 }] });
    return Response.json({ sites: [{ siteID: 11, available: true, minTotal: 1400, cheapest: { from: "2026-12-04", till: "2026-12-11" } }] });
  };
  const result = await getHomeHolidayDeals({ id: 140, token: "test", publicSiteIds: new Set([11]), now: new Date("2026-10-06T12:00:00Z"), fetchImpl });
  assert.equal(result.deals[0].total, 1400);
  assert.equal(calls.length, 4);
  await assert.rejects(getHomeHolidayDeals({ id: 160, token: "test", publicSiteIds: new Set(), now: new Date("2026-10-06T12:00:00Z"), fetchImpl }), /unsupported_holiday_window/);
});
