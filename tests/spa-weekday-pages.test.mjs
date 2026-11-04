import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spaWeekdayDate, spaWeekdayPath, spaWeekdaySlugs } from "../app/lib/spa-weekday-pages.ts";

test("spa weekday pages expose seven stable canonical slugs", () => {
  assert.deepEqual(spaWeekdaySlugs, ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
  assert.equal(new Set(spaWeekdaySlugs.map(spaWeekdayPath)).size, 7);
});

test("spa weekday date uses the next occurrence from the Israel deal day", () => {
  const now = new Date("2026-11-05T12:00:00+02:00");
  assert.equal(spaWeekdayDate("thursday", now), "2026-11-05");
  assert.equal(spaWeekdayDate("friday", now), "2026-11-06");
  assert.equal(spaWeekdayDate("wednesday", now), "2026-11-11");
  assert.equal(spaWeekdayDate("thursday", new Date("2026-11-05T13:59:59+02:00")), "2026-11-05");
  assert.equal(spaWeekdayDate("thursday", new Date("2026-11-05T14:00:00+02:00")), "2026-11-12");
  assert.equal(spaWeekdayDate("sunday", new Date("2026-03-29T13:59:59+03:00")), "2026-03-29");
  assert.equal(spaWeekdayDate("sunday", new Date("2026-03-29T14:00:00+03:00")), "2026-04-05");
});

test("weekday route, API seven-day payload and sitemap are wired", async () => {
  const route = await readFile(new URL("../app/spas/day/[weekday]/page.tsx", import.meta.url), "utf8");
  const deals = await readFile(new URL("../app/api/spa/deals/route.ts", import.meta.url), "utf8");
  const sitemap = await readFile(new URL("../app/lib/sitemap-inventory.ts", import.meta.url), "utf8");
  assert.match(route, /spaWeekdayMetadata/);
  assert.match(deals, /Array\.from\(\{ length: 7 \}/);
  assert.match(deals, /const offerDays = full \? \[requestedDate!\] : days/);
  assert.match(deals, /requestedDate/);
  for (const slug of spaWeekdaySlugs) assert.match(sitemap, new RegExp(`/spas/day/\\$\\{day\\}`));
});
