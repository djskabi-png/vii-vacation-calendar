import assert from "node:assert/strict";
import test from "node:test";

import catalog from "../app/data/sergey-public-catalog.json" with { type: "json" };
import { eventFacilityOrder, eventOccasionOrder, eventSearchFacilities, eventSearchOccasions, eventSearchVenueType, eventVenueTypeOrder, legacyEventFacilities, legacyEventOccasions, orderedEventFacetValues } from "../app/lib/event-search-taxonomy.ts";
import { publicEventSearchPlaces } from "../app/lib/public-event-search.ts";

const events = catalog.places.filter((place) => place.world === "events");
const projected = publicEventSearchPlaces(events);

test("event search exposes truthful non-empty venue, occasion and facility facets", () => {
  const types = new Set(projected.map((place) => place.type));
  const occasions = new Set(projected.flatMap((place) => place.eventTypes));
  const facilities = new Set(projected.flatMap((place) => place.features));
  assert.ok(types.size >= 3, `expected at least 3 venue types, received ${[...types].join(", ")}`);
  assert.ok(occasions.size >= 3, `expected at least 3 occasion types, received ${[...occasions].join(", ")}`);
  assert.ok(facilities.size >= 10, `expected at least 10 facilities, received ${[...facilities].join(", ")}`);
  for (const value of [...types, ...occasions, ...facilities]) {
    assert.ok(projected.some((place) => place.type === value || place.eventTypes.includes(value) || place.features.includes(value)), `${value} must match a place`);
  }
});

test("legacy reference labels are canonical and matching is evidence based", () => {
  const fixture = { name: "וילה למסיבות וימי הולדת", description: "מתאימה לאירועי חברה עם בריכה מחוממת, ג׳קוזי ועמדת DJ", features: ["מערכת הגברה", "פינת BBQ", "חניה פרטית"], audiences: [], type: "מקום לאירועים", eventTypes: [] };
  assert.equal(eventSearchVenueType(fixture), "וילות");
  assert.deepEqual(eventSearchOccasions(fixture), ["מסיבות", "ימי הולדת", "אירועי חברה"]);
  assert.deepEqual(eventSearchFacilities(fixture), ["בריכת שחייה", "בריכה מחוממת ומקורה", "ג׳קוזי ספא", "פינת מנגל", "מערכת הגברה", "עמדת דיג׳יי", "חניה פרטית"]);
  assert.equal(new Set(legacyEventOccasions.map((item) => item.label)).size, legacyEventOccasions.length);
  assert.equal(new Set(legacyEventFacilities.map((item) => item.label)).size, legacyEventFacilities.length);
});

test("generic supplier labels are replaced while verified supplier taxonomy is preserved", () => {
  const generic = events.find((place) => place.name.includes("לופט"));
  assert.ok(generic);
  assert.equal(eventSearchVenueType(generic), "לופטים");
  assert.equal(eventSearchVenueType({ ...generic, type: "אולם אירועים" }), "אולם אירועים");
});

test("facets follow the stable legacy order and retain verified additions", () => {
  assert.deepEqual(orderedEventFacetValues(["וילות", "לופטים", "מתחמי אירועים"], eventVenueTypeOrder), ["לופטים", "מתחמי אירועים", "וילות"]);
  assert.deepEqual(orderedEventFacetValues(["אירועי חברה", "מסיבות", "ימי הולדת"], eventOccasionOrder), ["מסיבות", "ימי הולדת", "אירועי חברה"]);
  assert.deepEqual(orderedEventFacetValues(["חניה פרטית", "מתקן מאומת נוסף", "בריכת שחייה"], eventFacilityOrder), ["בריכת שחייה", "חניה פרטית", "מתקן מאומת נוסף"]);
});
