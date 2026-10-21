import assert from "node:assert/strict";
import test from "node:test";

import catalog from "../app/data/sergey-public-catalog.json" with { type: "json" };
import { publicEventSearchPlaces } from "../app/lib/public-event-search.ts";
import { catalogResponse } from "../app/api/catalog/route.ts";
import { readFile } from "node:fs/promises";

const events = catalog.places.filter((place) => place.world === "events");

test("event search projection preserves discovery truth with a bounded payload", () => {
  const projected = publicEventSearchPlaces(events);

  assert.equal(projected.length, events.length);
  for (let index = 0; index < events.length; index += 1) {
    const original = events[index];
    const compact = projected[index];
    assert.equal(compact.slug, original.slug);
    assert.equal(compact.name, original.name);
    assert.equal(compact.location, original.location);
    assert.equal(compact.area, original.area);
    assert.ok(compact.eventTypes.length > 0 || !`${original.name} ${original.description} ${original.features.join(" ")}`.match(/מסיב|חגיג|משפח|קבוצ|גיבוש|יום כיף|חתונ|מצווה/));
    assert.equal(compact.description, "");
    assert.ok(compact.features.length <= 21);
    assert.ok(compact.images.length <= 5);
    assert.equal(Object.hasOwn(compact.contact || {}, "email"), false);
  }

  const originalBytes = Buffer.byteLength(JSON.stringify(events));
  const compactBytes = Buffer.byteLength(JSON.stringify(projected));
  assert.ok(compactBytes < originalBytes * 0.72, `${compactBytes} should be under 72% of ${originalBytes}`);
});

test("event catalog refresh uses the same bounded search projection as the server seed", async () => {
  const hook = await readFile(new URL("../app/lib/use-published-catalog.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/catalog/route.ts", import.meta.url), "utf8");
  assert.match(hook, /world === "vacations" \|\| world === "events"/);
  assert.match(route, /world === "events"[\s\S]*publicEventSearchPlaces/);
});

test("event search catalog endpoint returns populated canonical facets", async () => {
  const response = await catalogResponse(new Request("https://vii.example/api/catalog?world=events&view=search"), null);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.world, "events");
  assert.ok(body.entries.length > 100);
  assert.ok(new Set(body.entries.map((entry) => entry.summary.type)).size >= 3);
  assert.ok(new Set(body.entries.flatMap((entry) => entry.summary.eventTypes)).size >= 3);
  assert.ok(new Set(body.entries.flatMap((entry) => entry.summary.features)).size >= 10);
});

test("event filters remain operable in the mobile sheet", async () => {
  const page = await readFile(new URL("../app/events/search/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /className=\{`event-filter-toggle/);
  assert.match(page, /aria-controls="event-result-filters"/);
  assert.match(page, /id="event-result-filters"/);
  assert.match(page, /className="filter-panel__scroll"/);
  assert.match(css, /\.event-filter-toggle \{ display: inline-flex;/);
  assert.match(css, /\.filter-panel\.open \.filter-panel__scroll \{[^}]*overflow-y: auto/);
});
