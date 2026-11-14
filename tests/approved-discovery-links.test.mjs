import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { normalizeApprovedDiscoveryHref, approvedEventDiscoveryPaths } from "../app/lib/approved-discovery-hrefs.ts";
import { defaultEventLandingPresentation, parseEventLandingPresentation } from "../app/lib/event-landing-presentation.ts";
import { curatedEventSearchPages } from "../app/data/curated-event-search-pages.ts";
import { popularSearchWorlds, popularSearchesForWorld } from "../app/lib/world-popular-search-defaults.ts";
import { validManagedSearchList } from "../app/lib/homepage-search-href.ts";
import { bundledPublicCatalogSummaries } from "../app/lib/public-catalog-read.ts";
import { matchesEventOccasion } from "../app/lib/event-search-taxonomy.ts";

test("legacy event discovery parameters resolve to approved real pages", () => {
  assert.equal(normalizeApprovedDiscoveryHref("/events/search?eventType=יום הולדת"), approvedEventDiscoveryPaths.birthdays);
  assert.equal(normalizeApprovedDiscoveryHref("/events/search?eventType=אירועים משפחתיים"), approvedEventDiscoveryPaths.family);
  assert.equal(normalizeApprovedDiscoveryHref("/events/search?guests=100"), approvedEventDiscoveryPaths.large);
  assert.equal(normalizeApprovedDiscoveryHref("/events/search?unknown=1"), null);
  for (const item of defaultEventLandingPresentation.quickSearches) assert.equal(new URL(item.href, "https://vii.invalid").search, "");
});

test("managed quick-search content cannot publish an unresolved parameter URL", () => {
  const invalid = [{ id: "bad", label: "קישור לא מאושר", href: "/events/search?unknown=1", image: "/media/a.jpg", imageAlt: "תמונה", visible: true }];
  assert.equal(validManagedSearchList(JSON.stringify(invalid)), false);
  const parsed = parseEventLandingPresentation({ attributes: { eventQuickSearches: JSON.stringify(invalid) } });
  assert.deepEqual(parsed.quickSearches.map((item) => item.href), defaultEventLandingPresentation.quickSearches.map((item) => item.href));
});

test("an explicitly removed event quick-search rail stays empty", () => {
  const parsed = parseEventLandingPresentation({ attributes: { eventQuickSearches: "[]" } });
  assert.deepEqual(parsed.quickSearches, []);
});

test("every default popular-search destination is query-free", () => {
  for (const world of popularSearchWorlds) for (const item of popularSearchesForWorld(world.id)) {
    assert.equal(new URL(item.href, "https://vii.invalid").search, "", `${world.id}: ${item.href}`);
  }
});

test("approved birthday and family pages have real matching inventory", async () => {
  const catalog = await bundledPublicCatalogSummaries("events");
  for (const slug of ["birthday-venues", "family-events"]) {
    const page = curatedEventSearchPages.find((item) => item.slug === slug);
    assert.ok(page);
    const matches = catalog.filter((place) => matchesEventOccasion(place, String(page.filters.eventType)));
    assert.ok(matches.length > 0, slug);
    assert.equal(page.latestResultCount, matches.length, slug);
  }
});

test("approved event pages receive a complete server catalog seed", () => {
  const landing = readFileSync(new URL("../app/components/managed-search-landing.tsx", import.meta.url), "utf8");
  assert.match(landing, /publicCatalogSummaries<EventPlace>\("events"\)/);
  assert.match(landing, /<PublishedCatalogSeed world="events" entries=\{eventEntries\}>/);
});

test("homepage first paint is fed by the authoritative server presentation", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("../app/components/home-discovery-sections.tsx", import.meta.url), "utf8");
  assert.match(page, /readHomepagePresentation/);
  assert.match(page, /initialPresentation=\{homePresentation\}/);
  assert.doesNotMatch(component, /parseHomepagePresentation\(undefined, world\)/);
  assert.match(component, /if \(nearbyPage \|\| !presentation\?\.popular\.length\) return null/);
});

test("every managed world popular rail uses one server snapshot without a hydration refetch", () => {
  const serverRail = readFileSync(new URL("../app/components/managed-home-quick-searches.tsx", import.meta.url), "utf8");
  const clientRail = readFileSync(new URL("../app/components/home-discovery-sections.tsx", import.meta.url), "utf8");
  const eventsPage = readFileSync(new URL("../app/events/page.tsx", import.meta.url), "utf8");
  const worldLanding = readFileSync(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8");
  const corporatePage = readFileSync(new URL("../app/corporate/page.tsx", import.meta.url), "utf8");
  const specialWorld = readFileSync(new URL("../app/components/special-world-search.tsx", import.meta.url), "utf8");
  assert.match(serverRail, /readHomepagePresentation\(database, language, world\)/);
  assert.match(serverRail, /initialPresentation=\{presentation\}/);
  assert.match(clientRail, /if \(initialPresentation\) return/);
  for (const source of [eventsPage, worldLanding, corporatePage, specialWorld]) {
    assert.match(source, /ManagedHomeQuickSearches/);
    assert.doesNotMatch(source, /<HomeQuickSearches/);
  }
});

test("secondary discovery and footer links cannot emit parameter destinations", () => {
  const afterResults = readFileSync(new URL("../app/components/search-after-results.tsx", import.meta.url), "utf8");
  const footer = readFileSync(new URL("../app/data/footer-context.ts", import.meta.url), "utf8");
  assert.match(afterResults, /approvedDiscoveryLinks\(regionLinks\)/);
  assert.match(afterResults, /approvedDiscoveryLinks\(smartLinks\)/);
  assert.doesNotMatch(footer, /events\/search\?/);
  assert.doesNotMatch(footer, /hourly\?/);
  assert.doesNotMatch(footer, /trails\?area=/);
});
