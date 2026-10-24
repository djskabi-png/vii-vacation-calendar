import test from "node:test";
import assert from "node:assert/strict";
import { applyHolidayDisplaySettings, parseHomeDisplaySettings } from "../app/lib/home-display-settings.ts";
import { capHomeHolidayTabs } from "../app/lib/home-slider-contract.ts";

test("homepage editors control nearby tab labels, order and default while all required tabs remain visible", () => {
  const settings = parseHomeDisplaySettings({
    homePeriodOrder: "weekend,tomorrow,friday,thursday,friday-weekend",
    homePeriodHidden: "thursday",
    homePeriodDefault: "weekend",
    homePeriodLabels: JSON.stringify({ weekend: "סופ״ש פנוי" }),
  });
  assert.deepEqual(settings.periods.map((item) => [item.id, item.label]), [
    ["weekend", "סופ״ש פנוי"], ["tomorrow", "ברגע האחרון"], ["friday", "לילה בשישי"], ["thursday", "לילה בחמישי"], ["friday-weekend", "שישי עד ראשון"],
  ]);
  assert.equal(settings.defaultPeriod, "weekend");
});

test("homepage holiday controls hide, shorten, sort and cap the public holiday tabs", () => {
  const settings = parseHomeDisplaySettings({
    homeHolidayLimit: "2",
    homeHolidayHidden: "20",
    homeHolidayDates: JSON.stringify({ 30: { from: "2026-12-05", till: "2026-12-06" } }),
  });
  const holidays = [
    { id: 10, name: "א", from: "2026-11-01", till: "2026-11-03", nights: 2, windowSearch: false },
    { id: 20, name: "ב", from: "2026-11-05", till: "2026-11-07", nights: 2, windowSearch: false },
    { id: 30, name: "ג", from: "2026-12-04", till: "2026-12-11", nights: 2, windowSearch: false },
    { id: 40, name: "ד", from: "2027-01-01", till: "2027-01-03", nights: 2, windowSearch: false },
  ];
  assert.deepEqual(applyHolidayDisplaySettings(holidays, settings).map((item) => [item.id, item.from, item.till, item.nights, item.exactStay === true]), [
    [10, "2026-11-01", "2026-11-03", 2, false], [30, "2026-12-05", "2026-12-06", 1, true],
  ]);
});

test("homepage never exposes more than the first six visible holidays, including legacy CMS values", () => {
  const settings = parseHomeDisplaySettings({ homeHolidayLimit: "999", homeHolidayHidden: "2" });
  const holidays = Array.from({ length: 9 }, (_, index) => ({ id: index + 1, name: String(index + 1), from: `2027-01-${String(index + 1).padStart(2, "0")}`, till: `2027-01-${String(index + 2).padStart(2, "0")}`, nights: 1, windowSearch: false })).reverse();
  assert.equal(settings.holidayLimit, 6);
  assert.deepEqual(applyHolidayDisplaySettings(holidays, settings).map((item) => item.id), [1, 3, 4, 5, 6, 7]);
});

test("the client render boundary caps a stale pre-limit holiday snapshot", () => {
  const stale = Array.from({ length: 21 }, (_, index) => ({ id: index + 1 }));
  assert.deepEqual(capHomeHolidayTabs(stale).map((item) => item.id), [1, 2, 3, 4, 5, 6]);
  assert.equal(stale.length, 21, "the cached source value is not mutated");
});

test("legacy hidden settings cannot remove required nearby-date tabs", () => {
  const settings = parseHomeDisplaySettings({ homePeriodHidden: "tomorrow,weekend,friday-weekend,thursday,friday", homeHolidayLimit: "999", homeHolidayDates: "broken" }, "en");
  assert.deepEqual(settings.periods.map((item) => item.id), ["tomorrow", "weekend", "friday-weekend", "thursday", "friday"]);
  assert.equal(settings.defaultPeriod, "tomorrow");
  assert.equal(settings.holidayLimit, 6);
});
