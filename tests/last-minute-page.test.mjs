import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage last-minute link opens the permanent page", async () => {
  const component = await read("app/components/home-live-deals.tsx");
  assert.match(component, /period === "tomorrow"[\s\S]*?"\/last-minute"/);
  assert.match(component, /!fixedPeriod/);
});

test("permanent last-minute page uses verified tomorrow offers without a holiday identity", async () => {
  const [page, component] = await Promise.all([read("app/last-minute/page.tsx"), read("app/components/home-live-deals.tsx")]);
  assert.match(page, /נופש ברגע האחרון/);
  assert.match(page, /<HomeLiveDeals fixedPeriod="tomorrow"/);
  assert.match(page, /last-minute-escape\.webp/);
  assert.doesNotMatch(page, /חנוכה|Hanukkah/);
  assert.match(component, /new URLSearchParams\(\{ period, locale/);
  assert.match(component, /!fixedPeriod && result\.display/);
});

test("last-minute page includes SEO, breadcrumbs, FAQ and responsive media", async () => {
  const [page, css] = await Promise.all([read("app/last-minute/page.tsx"), read("app/last-minute/last-minute.css")]);
  assert.match(page, /alternates: \{ canonical \}/);
  assert.match(page, /breadcrumbSchema/);
  assert.match(page, /faqSchema/);
  assert.match(page, /last-minute-escape-mobile\.webp/);
  assert.match(css, /@media\(max-width:760px\)/);
});
