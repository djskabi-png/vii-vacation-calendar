import assert from "node:assert/strict";
import test from "node:test";
import { defaultHolidayWorld, fallbackHolidayForSlug, holidaySearchHref, holidaySlug, holidayWorldPath } from "../app/lib/holiday-world.ts";

test("Hanukkah 2026 has a stable clean route and complete planning world", () => {
  const holiday = fallbackHolidayForSlug("hanukkah");
  assert.ok(holiday);
  const world = defaultHolidayWorld(holiday);
  assert.equal(holidaySlug("חג חנוכה", 77), "hanukkah");
  assert.equal(holidayWorldPath("חנוכה", 77), "/holidays/hanukkah");
  assert.equal(world.from, "2026-12-04");
  assert.equal(world.till, "2026-12-12");
  assert.equal(world.searches.length, 6);
  assert.deepEqual(world.searches.slice(0, 3).map((item) => item.guests), [2, 6, 20]);
  assert.match(world.body, /4 בדצמבר 2026/);
  assert.match(world.body, /12 בדצמבר 2026/);
});

test("holiday search links carry the exact promised window and party size", () => {
  const world = defaultHolidayWorld(fallbackHolidayForSlug("hanukkah"));
  for (const card of world.searches) {
    const url = new URL(holidaySearchHref(card), "https://vii.spaplus.co");
    assert.equal(url.pathname, "/search");
    assert.equal(url.searchParams.get("from"), card.from);
    assert.equal(url.searchParams.get("till"), card.till);
    assert.equal(url.searchParams.get("guests"), String(card.guests));
    assert.ok(card.from < card.till);
  }
});

test("unknown supplier holidays still receive a deterministic unique route", () => {
  assert.equal(holidaySlug("חג חדש", 984), "holiday-984");
  assert.equal(holidayWorldPath("חג חדש", 984), "/holidays/holiday-984");
  assert.equal(fallbackHolidayForSlug("holiday-984"), null);
});
