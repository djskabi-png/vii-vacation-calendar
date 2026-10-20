import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const eventsPage = fs.readFileSync(new URL("../app/events/page.tsx", import.meta.url), "utf8");
const editorialLinks = fs.readFileSync(new URL("../app/components/world-editorial-links.tsx", import.meta.url), "utf8");

test("event venue cards and editorial links use distinct bounded rails", () => {
  assert.match(eventsPage, /<EventRail shufflePlaces warmAheadImages title=\{translate\("מקומות לאירועים"\)\}>/);
  assert.match(eventsPage, /className="event-rail-card event-card event-world-card"/);
  assert.doesNotMatch(eventsPage, /eventPlaces\.slice\(0,\s*4\)/);
  assert.match(editorialLinks, /id="world-editorial-rail"/);
  assert.match(editorialLinks, /className="world-editorial__grid"/);
});
