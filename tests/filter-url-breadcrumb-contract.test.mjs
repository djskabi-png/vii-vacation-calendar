import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("all rendered breadcrumbs use the shared accessible component", () => {
  const files = [
    "app/search/page.tsx",
    "app/events/search/page.tsx",
    "app/attractions/page.tsx",
    "app/questions/page.tsx",
    "app/events/place/client-page.tsx",
    "app/trails/[slug]/page.tsx",
    "app/guides/article/client-page.tsx",
  ];
  files.forEach((file) => assert.match(read(file), /BreadcrumbTrail/));
  files.forEach((file) => assert.doesNotMatch(read(file), /<nav[^>]+breadcrumbs/));
});

test("vacation and event filters serialize and restore their complete state", () => {
  const vacation = read("app/search/page.tsx");
  ["accessible", "features", "sort"].forEach((key) => assert.match(vacation, new RegExp(`\\.get\\(\"${key}\"\\)`)));
  assert.match(vacation, /toggleExtraFilter/);
  assert.match(vacation, /changeSort/);

  const events = read("app/events/search/page.tsx");
  ["type", "eventType", "noise", "accessible", "sort"].forEach((key) => assert.match(events, new RegExp(`params\\.get\\(\"${key}\"\\)`)));
  assert.match(events, /function changeFilter/);
});

test("attractions, trails, spa and hourly filters have shareable URL state", () => {
  const expectations = [
    ["app/attractions/attractions-explorer.tsx", ["q", "area", "type"]],
    ["app/trails/trails-explorer.tsx", ["q", "area", "nature", "difficulty"]],
    ["app/components/world-map-results.tsx", ["location", "spaFor", "features"]],
    ["app/components/hourly-results.tsx", ["location", "maxPrice", "features"]],
  ];
  expectations.forEach(([file, keys]) => {
    const source = read(file);
    assert.match(source, /window\.history\.replaceState/);
    keys.forEach((key) => assert.match(source, new RegExp(key)));
  });
});
