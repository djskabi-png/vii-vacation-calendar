import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hasConfirmedDatedAvailability, hasConfirmedEventAvailability } from "../app/lib/dated-availability-eligibility.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("vacation dated eligibility accepts only an exact positive availability proof", () => {
  const selection = { from: "2026-11-10", till: "2026-11-12" };
  const exact = { status: "ready", quote: { ...selection, availability: "available" } };
  assert.equal(hasConfirmedDatedAvailability(exact, selection), true);
  for (const state of [
    { status: "loading", quote: null },
    { status: "error", quote: null },
    { status: "ready", quote: { ...selection, availability: "unknown" } },
    { status: "ready", quote: { ...selection, availability: "unavailable" } },
    { status: "ready", quote: { ...selection, from: "2026-11-11", availability: "available" } },
  ]) assert.equal(hasConfirmedDatedAvailability(state, selection), false);
});

test("event dated eligibility rejects unknown, unavailable and zero-price offers", () => {
  assert.equal(hasConfirmedEventAvailability({ available: true, total: 900, from: "2026-11-10" }), true);
  assert.equal(hasConfirmedEventAvailability({ available: true, total: 0, from: "2026-11-10" }), false);
  assert.equal(hasConfirmedEventAvailability({ available: null, total: 900, from: "2026-11-10" }), false);
  assert.equal(hasConfirmedEventAvailability({ available: false, total: 900, from: "2026-11-10" }), false);
});

test("all dated result families fail closed instead of falling back to the ordinary catalog", async () => {
  const vacation = await read("app/search/page.tsx");
  assert.match(vacation, /\.filter\(\(property\) => confirmedForSelectedStay\(property\)\)/);
  assert.match(vacation, /selectedStay && !onlineOnly/);

  const events = await read("app/events/search/page.tsx");
  assert.match(events, /matchesHardFilters\(place\) && confirmedEventPlace\(place\)/);
  assert.match(events, /datedEventSearch && \(eventAvailabilityPending \|\| eventAvailabilityError/);

  const spa = await read("app/components/world-map-results.tsx");
  assert.match(spa, /!requestedDate \|\| \(datedAvailabilityReady && availability\.sites\.has/);
  assert.doesNotMatch(spa, /!requestedDate \|\| !dateCovered \|\| availability\.sites\.has/);
  assert.match(spa, /availabilityFailed \? <div className="spa-results__empty" role="alert"/);
});

test("dated discovery cache is explicit and booking/detail calls remain realtime", async () => {
  const hook = await read("app/components/use-vii-live-search.ts");
  const route = await read("app/api/vii/live-search/route.ts");
  assert.match(hook, /datedDiscovery \? \{ discoverySearch: true \} : \{\}/);
  assert.match(route, /body\.discoverySearch === true && body\.includePlaces !== true/);
  assert.match(route, /\["dated-search", world, body\.from, body\.till, Number\(body\.guests\)/);
});

test("search summary shows committed dates for vacation, events and spa", async () => {
  const source = await read("app/components/search-box.tsx");
  const label = source.slice(source.indexOf("function dateLabelFromSearch"), source.indexOf("function activeRouteLanguage"));
  assert.match(label, /mode === "spa"/);
  assert.match(label, /searchParams\.get\("date"\)/);
  assert.match(label, /mode === "events"/);
  assert.match(label, /searchParams\.get\("to"\) \|\| from/);
});
