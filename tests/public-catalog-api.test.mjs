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
  assert.ok(body.entries.length > 500);
  assert.equal(body.entries.some((entry) => entry.summary?.name === "המתחם הקטלני של רועי"), false);
  assert.equal(body.entries[0].summary.world, "vacations");
});

test("serves the accepted bundled event snapshot when an active run has no materialized rows", async () => {
  const db = { prepare() { return {
    bind() { return this; },
    async first() { return { activeRunId: "incomplete-event-run", activeCount: 1, acceptedAt: "2026-10-27T00:00:00Z" }; },
    async all() { return { results: [] }; },
  }; } };
  const response = await catalogResponse(request("world=events&view=search"), db);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source, "bundled-fallback");
  assert.ok(body.entries.length > 0);
});

test("serves the accepted bundled spa snapshot when its runtime generation is unreadable", async () => {
  const db = { prepare() { return {
    bind() { return this; },
    async first() { throw new Error("runtime temporarily unavailable"); },
  }; } };
  const response = await catalogResponse(request("world=spa"), db);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source, "bundled-fallback");
  assert.ok(body.entries.length > 100);
  assert.ok(body.entries.every((entry) => entry.summary?.id && entry.summary?.title));
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

test("rooms catalog quarantines only the known mismatched summary in list and id responses", async () => {
  const list = await (await catalogResponse(request("world=rooms"), null)).json();
  const sunset = list.entries.find((entry) => entry.supplierId === 1181);
  const hidden = list.entries.find((entry) => entry.summary?.name === "שדה נסתר");
  assert.equal(sunset.summary.description, "");
  assert.match(hidden.summary.description, /שדה נסתר בתל מונד/);
  const detail = await (await catalogResponse(request("world=rooms&id=1181"), null)).json();
  assert.equal(detail.entry.summary.description, "");
});

test("accepted runtime rooms are projected without mutating stored source or losing future corrected text", async () => {
  const bundled = JSON.parse(await readFile(new URL("../app/data/sergey-hourly-catalog.json", import.meta.url), "utf8"));
  const summary = structuredClone(bundled.places.find((place) => place.id === "hourly-1181"));
  const sourceDescription = summary.description;
  const db = { prepare(sql) { return {
    bind() { return this; },
    async first() { return !sql.includes("JOIN")
      ? { activeRunId: "accepted-rooms", activeCount: 1, acceptedAt: "2026-10-17T12:00:00Z" }
      : { supplierId: 1181, summaryJson: JSON.stringify(summary), detailJson: null, acceptedAt: "2026-10-17T12:00:00Z" }; },
    async all() { return { results: [{ supplierId: 1181, summaryJson: JSON.stringify(summary) }] }; },
  }; } };
  const list = await (await catalogResponse(request("world=rooms"), db)).json();
  assert.equal(list.source, "runtime");
  assert.equal(list.entries[0].summary.description, "");
  const detail = await (await catalogResponse(request("world=rooms&id=1181"), db)).json();
  assert.equal(detail.source, "runtime");
  assert.equal(detail.entry.summary.description, "");
  assert.equal(summary.description, sourceDescription);
  summary.description = "תיאור מתוקן של שקיעה בזכרון";
  const corrected = await (await catalogResponse(request("world=rooms&id=1181"), db)).json();
  assert.equal(corrected.entry.summary.description, summary.description);
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

test("runtime fixture rows stay out of list, lookup, search, and direct detail responses", async () => {
  const fixture = { slug: "vacation-389", supplierId: 389, world: "vacations", name: "המתחם הקטלני של רועי", location: "ראשון לציון", area: "מרכז", contact: { phone: "050-1234567" } };
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes("JOIN")) return { supplierId: 389, summaryJson: JSON.stringify(fixture), detailJson: JSON.stringify({}), acceptedAt: "2026-10-12T12:00:00Z" };
          if (sql.includes("supplier_catalog_state")) return { activeRunId: "accepted", activeCount: 1, acceptedAt: "2026-10-12T12:00:00Z" };
          return null;
        },
        async all() { return { results: [{ supplierId: 389, summaryJson: JSON.stringify(fixture) }] }; },
      };
    },
  };
  for (const query of ["world=vacations", "world=vacations&view=lookup", "world=vacations&view=search"]) {
    const response = await catalogResponse(request(query), db);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal((body.entries || body.places).length, 0);
  }
  assert.equal((await catalogResponse(request("world=vacations&id=389"), db)).status, 404);
});

test("search paints bounded snapshots and replaces them with the accepted catalog", async () => {
  const root = new URL("../", import.meta.url);
  const [hook, vacation, events, recommendations, vacationLayout, eventLayout] = await Promise.all([
    readFile(new URL("app/lib/use-published-catalog.ts", root), "utf8"),
    readFile(new URL("app/search/page.tsx", root), "utf8"),
    readFile(new URL("app/events/search/page.tsx", root), "utf8"),
    readFile(new URL("app/components/search-after-results.tsx", root), "utf8"),
    readFile(new URL("app/search/layout.tsx", root), "utf8"),
    readFile(new URL("app/events/search/layout.tsx", root), "utf8"),
  ]);
  assert.match(hook, /useState<T\[\]>\(\(\) => \(seed \|\| \[\]\)\.map\(map\)\)/);
  assert.match(hook, /if \(seed === null \|\| !seedComplete\) void load\(\)/);
  assert.match(hook, /visibilitychange/);
  assert.match(vacationLayout, /bundledPublicCatalogSummaries<Property>\("vacations"\)/);
  assert.match(eventLayout, /bundledPublicCatalogSummaries<EventPlace>\("events"\)/);
  assert.match(vacationLayout, /complete=\{false\}/);
  assert.match(eventLayout, /complete=\{false\}/);
  assert.match(hook, /if \(!hasAcceptedContent\.current\) setItems\(\[\]\);\s*setError\(!hasAcceptedContent\.current\)/);
  assert.match(hook, /hasAcceptedContent\.current = true/);
  assert.match(hook, /requestIdleCallback/);
  assert.match(vacation, /!catalogLoading && !catalogError && \(mapOpen && mapVisibleIds \? displayedResults\.length === 0 : resultSet\.length === 0\)/);
  assert.match(events, /!catalogLoading && !catalogError && displayed\.length === 0/);
  assert.match(vacation, /inventory=\{properties\}/);
  assert.match(events, /inventory=\{eventPlaces\}/);
  assert.doesNotMatch(recommendations, /import \{ eventPlaces, properties \}/);
});
