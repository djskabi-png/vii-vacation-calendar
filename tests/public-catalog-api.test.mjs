import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { catalogResponse } from "../app/api/catalog/route.ts";

function request(query) {
  return new Request(`https://vii.spaplus.co/api/catalog?${query}`);
}

test("serves a clearly identified bundled catalog before runtime publication", async () => {
  const response = await catalogResponse(request("world=vacations"), null);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source, "bundled-fallback");
  assert.equal(body.entries.length, 573);
  assert.equal(body.entries[0].summary.world, "vacations");
});

test("does not resurrect a removed place from the bundled fallback", async () => {
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          return sql.includes("FROM supplier_catalog_state WHERE world")
            ? { activeRunId: "published-run", activeCount: 1, acceptedAt: "2026-10-12T12:00:00Z" }
            : null;
        },
      };
    },
  };
  const response = await catalogResponse(request("world=vacations&id=1"), db);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "not_found");
});

test("rejects invalid identifiers without querying a supplier or database", async () => {
  assert.equal((await catalogResponse(request("world=unknown"), null)).status, 400);
  assert.equal((await catalogResponse(request("world=spa&id=not-a-number"), null)).status, 400);
  assert.equal((await catalogResponse(request("world=spa&view=lookup&id=6"), null)).status, 400);
});

test("serves compact named-place lookup for all four published worlds", async () => {
  for (const [world, prefix] of [["vacations", "/business?id=vacation-"], ["events", "/events/place/event-"],
    ["rooms", "/discover/place/hourly-"], ["spa", "/discover/place/spa-"]]) {
    const response = await catalogResponse(request(`world=${world}&view=lookup`), null);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.ok(body.places.length > 0);
    assert.ok(body.places.some((place) => place.href.startsWith(prefix)));
    assert.ok(body.places.every((place) => place.id && place.name && !Object.hasOwn(place, "images")));
    const full = await (await catalogResponse(request(`world=${world}`), null)).text();
    assert.ok(JSON.stringify(body).length < full.length * 0.5);
  }
});

test("named-place lookup uses only the accepted D1 generation", async () => {
  const summary = { slug: "vacation-9999", name: "מקום חדש", location: "חיפה", area: "חיפה" };
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() { return sql.includes("supplier_catalog_state")
          ? { activeRunId: "accepted", activeCount: 1, acceptedAt: "2026-10-12T12:00:00Z" } : null; },
        async all() { return { results: [{ supplierId: 9999, summaryJson: JSON.stringify(summary) }] }; },
      };
    },
  };
  const response = await catalogResponse(request("world=vacations&view=lookup"), db);
  const body = await response.json();
  assert.equal(body.source, "runtime");
  assert.deepEqual(body.places.map((place) => place.id), ["vacation-9999"]);
});

test("search does not flash bundled supplier places before the accepted catalog loads", async () => {
  const root = new URL("../", import.meta.url);
  const [hook, vacation, events, recommendations, vacationLayout, eventLayout] = await Promise.all([
    readFile(new URL("app/lib/use-published-catalog.ts", root), "utf8"),
    readFile(new URL("app/search/page.tsx", root), "utf8"),
    readFile(new URL("app/events/search/page.tsx", root), "utf8"),
    readFile(new URL("app/components/search-after-results.tsx", root), "utf8"),
    readFile(new URL("app/search/layout.tsx", root), "utf8"),
    readFile(new URL("app/events/search/layout.tsx", root), "utf8"),
  ]);
  assert.match(hook, /useState<T\[\]>\(\(\) => seed\.map\(map\)\)/);
  assert.match(vacationLayout, /publicCatalogSummaries<Property>\("vacations"\)/);
  assert.match(eventLayout, /publicCatalogSummaries<EventPlace>\("events"\)/);
  assert.match(hook, /setItems\(\[\]\);\s*setError\(true\)/);
  assert.match(vacation, /!catalogLoading && !catalogError && .*filtered\.length === 0/);
  assert.match(events, /!catalogLoading && !catalogError && displayed\.length === 0/);
  assert.match(vacation, /inventory=\{properties\}/);
  assert.match(events, /inventory=\{eventPlaces\}/);
  assert.doesNotMatch(recommendations, /import \{ eventPlaces, properties \}/);
});
