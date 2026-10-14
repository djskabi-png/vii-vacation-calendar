import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live deal cards communicate availability, price basis and the requested Hebrew singular", async () => {
  const component = await read("app/components/home-live-deals.tsx");
  assert.match(component, /פנוי לתאריכים שבחרתם/);
  assert.match(component, /עבור 2 אורחים/);
  assert.match(component, /`\$\{text\.night\} 1`/);
  assert.match(component, /href=\{tel\}/);
  assert.doesNotMatch(component, /אפשר להזמין באתר|להזמנה מתקשרים למקום|bookingModeCopy/);
});

test("period navigation and carousel controls reflect the active context and real boundaries", async () => {
  const component = await read("app/components/home-live-deals.tsx");
  assert.match(component, /לכל מקומות הנופש ברגע האחרון/);
  assert.match(component, /לכל מקומות הנופש מחמישי עד שבת/);
  assert.match(component, /first\.right > bounds\.right/);
  assert.match(component, /last\.left < bounds\.left/);
  assert.match(component, /!railState\.previous/);
  assert.match(component, /!railState\.next/);
});

test("content studio exposes explicit homepage placement, order and hide controls for vacations", async () => {
  const admin = await read("app/admin/content-studio/page.tsx");
  assert.match(admin, /שליטה באזורי הנופש בעמוד הבית/);
  assert.match(admin, /homeDealPlacements/);
  assert.match(admin, /homeDealOrder/);
  assert.match(admin, /homeDealHidden/);
  assert.match(admin, /המקום יוצג רק אם ה־API מאשר שהוא פנוי/);
});

test("content studio owns homepage period tabs and supplier holiday presentation", async () => {
  const [admin, inventory, component] = await Promise.all([
    read("app/admin/content-studio/page.tsx"), read("app/lib/content-studio-inventory.ts"), read("app/components/home-live-deals.tsx"),
  ]);
  assert.match(inventory, /type: "homepage", key: "vacation-sliders"/);
  for (const field of ["homePeriodOrder", "homePeriodDefault", "homePeriodHidden", "homePeriodLabels", "homeHolidayLimit", "homeHolidayHidden", "homeHolidayDates"]) assert.match(admin, new RegExp(field));
  assert.match(component, /result\.display\?\.periods/);
  assert.match(component, /selectedHoliday\.from/);
  assert.match(component, /<strong>\{item\.name\}<\/strong><small>/);
});
