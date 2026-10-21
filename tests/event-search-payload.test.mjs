import assert from "node:assert/strict";
import test from "node:test";

import catalog from "../app/data/sergey-public-catalog.json" with { type: "json" };
import { publicEventSearchPlaces } from "../app/lib/public-event-search.ts";

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
    assert.deepEqual(compact.eventTypes, original.eventTypes);
    assert.equal(compact.description, "");
    assert.ok(compact.features.length <= 1);
    assert.ok(compact.images.length <= 5);
    assert.equal(Object.hasOwn(compact.contact || {}, "email"), false);
  }

  const originalBytes = Buffer.byteLength(JSON.stringify(events));
  const compactBytes = Buffer.byteLength(JSON.stringify(projected));
  assert.ok(compactBytes < originalBytes * 0.6, `${compactBytes} should be under 60% of ${originalBytes}`);
});
