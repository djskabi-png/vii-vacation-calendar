import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { permanentHomePeriodLandings, weekendLandingPeriods } from "../app/lib/home-period-landings.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("each near-term home tab owns a permanent landing URL", () => {
  assert.deepEqual(permanentHomePeriodLandings, {
    tomorrow: "/last-minute",
    weekend: "/weekend/thursday-to-saturday",
    "friday-weekend": "/weekend/friday-to-sunday",
    thursday: "/weekend/thursday-night",
    friday: "/weekend/friday-night",
  });
  assert.equal(new Set(Object.values(permanentHomePeriodLandings)).size, 5);
  assert.equal(Object.keys(weekendLandingPeriods).length, 4);
});

test("home links, real pages, metadata, sitemap and structured content stay connected", async () => {
  const [home, page, sitemap] = await Promise.all([
    read("app/components/home-live-deals.tsx"),
    read("app/weekend/[period]/page.tsx"),
    read("app/lib/sitemap-inventory.ts"),
  ]);
  assert.match(home, /permanentHomePeriodLandings\[period\]/);
  assert.match(home, /function choose\(value: HomeDealPeriod\) \{[^}]*displaySettingsApplied\.current = true;/);
  assert.match(page, /generateStaticParams/);
  assert.match(page, /alternates: \{ canonical \}/);
  assert.match(page, /breadcrumbSchema/);
  assert.match(page, /faqSchema/);
  assert.match(page, /homeFallbackProperties/);
  assert.doesNotMatch(page, /bundledPublicCatalogSummaries|publicVacationSearchProperties/);
  for (const path of Object.values(permanentHomePeriodLandings)) assert.match(sitemap, new RegExp(path.replaceAll("/", "\\/")));
});
