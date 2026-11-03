import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("event last-minute slider links to its dedicated localized landing", async () => {
  const source = await read("app/components/event-last-minute.tsx");
  assert.match(source, /selectedPreset === "lastminute" \? "\/events\/last-minute"/);
  assert.match(source, /localizedPath\(searchPath, language\)/);
  assert.match(source, /visibleAdditionalPlaces = showBrowseFallback \? additionalPlaces : \[\]/);
  assert.match(source, /fallbackStatus/);
});

test("event last-minute landing fixes the verified preset and exposes SEO", async () => {
  const page = await read("app/events/last-minute/page.tsx");
  assert.match(page, /אירועים ברגע האחרון/);
  assert.match(page, /fixedPreset="lastminute"/);
  assert.match(page, /layout="grid"/);
  assert.match(page, /alternates:\{canonical\}/);
  assert.match(page, /breadcrumbSchema/);
  assert.match(page, /faqSchema/);
});

test("spa slider links today and tomorrow to dedicated localized landings", async () => {
  const source = await read("app/components/spa-package-deals.tsx");
  assert.match(source, /date === today \? "\/spas\/today" : date === tomorrow \? "\/spas\/tomorrow"/);
  assert.match(source, /localizedPath\(allHref,language\)/);
  assert.match(source, /fixedDateOffset===undefined/);
});

test("spa today and tomorrow pages share the fixed-date landing contract", async () => {
  const [shared, today, tomorrow] = await Promise.all([
    read("app/spas/deal-day-page.tsx"),
    read("app/spas/today/page.tsx"),
    read("app/spas/tomorrow/page.tsx"),
  ]);
  assert.match(shared, /fixedDateOffset=\{day==="today"\?0:1\}/);
  assert.match(shared, /layout="grid"/);
  assert.match(shared, /breadcrumbSchema/);
  assert.match(shared, /faqSchema/);
  assert.match(today, /spaDealDayMetadata\(language,"today"\)/);
  assert.match(tomorrow, /spaDealDayMetadata\(language,"tomorrow"\)/);
});

test("new contextual landings are included in sitemap and recurring QA", async () => {
  const [sitemap, quality] = await Promise.all([read("app/lib/sitemap-inventory.ts"), read("app/lib/quality-platform.ts")]);
  for (const route of ["/events/last-minute", "/spas/today", "/spas/tomorrow"]) {
    assert.ok(sitemap.includes(route), `${route} missing from sitemap`);
    assert.ok(quality.includes(route), `${route} missing from quality registry`);
  }
});
