import test from "node:test";
import assert from "node:assert/strict";
import { applyHolidayDisplaySettings, parseHomeDisplaySettings } from "../app/lib/home-display-settings.ts";

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

test("homepage holiday controls hide, shorten and sort every future supplier holiday without a public cap", () => {
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
    [40, "2027-01-01", "2027-01-03", 2, false],
  ]);
});

test("legacy hidden settings cannot remove required nearby-date tabs", () => {
  const settings = parseHomeDisplaySettings({ homePeriodHidden: "tomorrow,weekend,friday-weekend,thursday,friday", homeHolidayLimit: "999", homeHolidayDates: "broken" }, "en");
  assert.deepEqual(settings.periods.map((item) => item.id), ["tomorrow", "weekend", "friday-weekend", "thursday", "friday"]);
  assert.equal(settings.defaultPeriod, "tomorrow");
  assert.equal(settings.holidayLimit, 12);
});
