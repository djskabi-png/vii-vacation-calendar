import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import test from "node:test";
import { defaultHolidayWorld, fallbackHolidayForSlug, holidayHeroImage, holidaySearchHref, holidaySlug, holidayWorldPath } from "../app/lib/holiday-world.ts";

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

test("legacy provider-id holiday routes remain recoverable after stable slugs are introduced", () => {
  assert.equal(fallbackHolidayForSlug("holiday-139")?.name, "יום האהבה");
  assert.equal(fallbackHolidayForSlug("holiday-134")?.name, "רמאדן");
});

test("every current holiday identity has a stable route, dedicated image and provider-outage fallback", () => {
  const expected = {
    "חג הסיגד": "sigd", חנוכה: "hanukkah", סילבסטר: "new-years-eve", רמאדן: "ramadan", "יום האהבה": "valentines-day",
    "עיד אל פיטר": "eid-al-fitr", פורים: "purim", פסח: "passover", "חג הנביא שועייב": "nabi-shuayb", מימונה: "mimouna",
    "יום הזיכרון": "memorial-day", "יום העצמאות": "independence-day", "עיד אל אדחא": "eid-al-adha", "לג בעומר": "lag-baomer",
    שבועות: "shavuot", "ראש השנה": "rosh-hashana", "יום כיפור": "yom-kippur", סוכות: "sukkot", "שמחת תורה": "simchat-torah",
  };
  for (const [name, slug] of Object.entries(expected)) {
    assert.equal(holidaySlug(name, 999), slug);
    assert.equal(holidayWorldPath(name, 999), `/holidays/${slug}`);
    assert.equal(holidayHeroImage(slug), `/images/holidays/${slug}.webp`);
    assert.equal(fallbackHolidayForSlug(slug)?.name, name);
  }
});

test("a future unknown holiday still receives a safe editorial fallback image", () => {
  const world = defaultHolidayWorld({ id: 999, name: "חג עתידי חדש", from: "2028-02-01", till: "2028-02-03", nights: 2, windowSearch: false });
  assert.equal(world.slug, "holiday-999");
  assert.equal(world.heroImage, "/images/holidays/holiday-default.webp");
  assert.equal(world.heroImageAlt, "חג עתידי חדש");
});

test("holiday editorial assets are distinct optimized WebP files with mobile variants", async () => {
  const slugs = ["sigd", "hanukkah", "new-years-eve", "ramadan", "valentines-day", "eid-al-fitr", "purim", "passover", "nabi-shuayb", "mimouna", "memorial-day", "independence-day", "eid-al-adha", "lag-baomer", "shavuot", "rosh-hashana", "yom-kippur", "sukkot", "simchat-torah", "holiday-default"];
  const hashes = new Set();
  for (const slug of slugs) {
    const desktop = await fs.readFile(new URL(`../public/images/holidays/${slug}.webp`, import.meta.url));
    const mobile = await fs.readFile(new URL(`../public/images/holidays/${slug}-mobile.webp`, import.meta.url));
    assert.equal(desktop.toString("ascii", 8, 12), "WEBP", `${slug} desktop must decode as WebP`);
    assert.equal(mobile.toString("ascii", 8, 12), "WEBP", `${slug} mobile must decode as WebP`);
    assert.ok(desktop.length < 400_000, `${slug} desktop exceeds the 400KB budget`);
    assert.ok(mobile.length < 120_000, `${slug} mobile exceeds the 120KB budget`);
    const hash = crypto.createHash("sha256").update(desktop).digest("hex");
    assert.ok(!hashes.has(hash), `${slug} reuses another holiday image`);
    hashes.add(hash);
  }
});
