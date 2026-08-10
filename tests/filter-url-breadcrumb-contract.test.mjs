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

  const trail = read("app/components/breadcrumb-trail.tsx");
  const styles = read("app/globals.css");
  assert.match(trail, /aria-label="פירורי לחם"/);
  assert.match(trail, /<ol className="breadcrumbs__list">/);
  assert.match(trail, /<li className="breadcrumbs__item"/);
  assert.match(trail, /aria-current=\{current \? "page"/);
  assert.match(styles, /\.breadcrumbs__item \[aria-current="page"\]/);
  assert.match(styles, /\.breadcrumbs__item a:focus-visible/);
  assert.match(styles, /:dir\(ltr\) \.breadcrumbs__separator svg/);
});

test("vacation and event filters serialize and restore their complete state", () => {
  const vacation = read("app/search/page.tsx");
  const vacationUrl = read("app/lib/vacation-search-url.ts");
  ["accessible", "features", "sort"].forEach((key) => assert.match(vacation, new RegExp(`\\.get\\(\"${key}\"\\)`)));
  assert.match(vacation, /toggleExtraFilter/);
  assert.match(vacation, /changeSort/);
  assert.match(vacation, /useSearchParams/);
  assert.match(vacation, /params\.get\("adults"\)/);
  assert.match(vacationUrl, /params\.set\("location", nextArea\)/);
  assert.match(vacationUrl, /nextTypes\.length === 1/);
  assert.match(vacationUrl, /params\.set\("types", nextTypes\.join\(","\)\)/);
  assert.match(vacationUrl, /params\.delete\("type"\)/);
  assert.match(vacationUrl, /return query \? `\$\{path\}\?\$\{query\}` : path/);
  const landings = read("app/data/accommodation-landings.ts");
  ["וילות", "דירות נופש", "סוויטות"].forEach((label) => assert.match(landings, new RegExp(`"${label}"`)));

  const events = read("app/events/search/page.tsx");
  ["type", "eventType", "noise", "accessible", "sort"].forEach((key) => assert.match(events, new RegExp(`params\\.get\\(\"${key}\"\\)`)));
  assert.match(events, /function changeFilter/);
});

test("provider filters serialize, restore and reset their complete state", () => {
  const providers = read("app/components/provider-results.tsx");
  ["q", "region", "category"].forEach((key) => assert.match(providers, new RegExp(`searchParams\\.get\\(\"${key}\"\\)`)));
  assert.match(providers, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(providers, /window\.history\.pushState/);
  assert.match(providers, /function resetFilters/);
});

test("attractions, trails, spa and hourly filters have shareable URL state", () => {
  const expectations = [
    ["app/attractions/attractions-explorer.tsx", ["q", "area", "type"], /window\.history\.pushState/],
    ["app/trails/trails-explorer.tsx", ["q", "area", "nature", "difficulty"], /window\.history\.pushState/],
    ["app/components/world-map-results.tsx", ["location", "spaFor", "features"], /router\.push/],
    ["app/components/hourly-results.tsx", ["location", "maxPrice", "features"], /router\.push/],
  ];
  expectations.forEach(([file, keys, navigation]) => {
    const source = read(file);
    assert.match(source, navigation);
    keys.forEach((key) => assert.match(source, new RegExp(key)));
  });
});

test("spa, events and hourly preserve location in semantic search routes", () => {
  const spa = read("app/data/spa-search-landings.ts");
  assert.match(spa, /spaSearchStateFromSegments/);
  assert.match(spa, /spaSearchHref/);
  assert.match(spa, /spaSearchTitle/);
  assert.match(spa, /slug: "spa-day-pass"/);
  assert.match(spa, /getSpaDetails\(item\.id\)\?\.packages/);
  assert.match(spa, /matchesSearchLocation/);

  const spaPage = read("app/spas/search/[...segments]/page.tsx");
  assert.match(spaPage, /alternates: \{ canonical: path \}/);
  assert.match(spaPage, /collectionSchema/);
  assert.match(spaPage, /initialSearchLocation/);
  assert.match(spaPage, /initialSpaAudience/);
  assert.match(spaPage, /initialSpaFilters/);

  const shared = read("app/data/world-search-landings.ts");
  assert.match(shared, /eventSearchHref/);
  assert.match(shared, /hourlySearchHref/);
  assert.match(read("app/events/search/page.tsx"), /eventHeading/);
  assert.match(read("app/events/search/[region]/page.tsx"), /alternates: \{ canonical: url \}/);
  assert.match(read("app/hourly/search/[region]/page.tsx"), /alternates: \{ canonical: url \}/);
  const heading = read("app/components/semantic-world-heading.tsx");
  assert.match(heading, /spaSearchStateFromSegments/);
  assert.match(heading, /spaSearchTitle/);
  assert.match(heading, /searchParams\.get\("features"\)/);
  assert.match(heading, /queryFeatures\.filter/);

  const sitemap = read("app/sitemap.ts");
  assert.match(sitemap, /indexableSpaSearchStates/);
  assert.match(sitemap, /eventSearchHref/);
  assert.match(sitemap, /hourlySearchHref/);
});
