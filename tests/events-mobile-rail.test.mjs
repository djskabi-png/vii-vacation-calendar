import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const eventsPage = fs.readFileSync(new URL("../app/events/page.tsx", import.meta.url), "utf8");
const editorialLinks = fs.readFileSync(new URL("../app/components/world-editorial-links.tsx", import.meta.url), "utf8");

test("event long cards and editorial links use distinct mobile rails", () => {
  assert.match(eventsPage, /id="events-world-places"/);
  assert.match(eventsPage, /className="event-card-grid"/);
  assert.match(editorialLinks, /id="world-editorial-rail"/);
  assert.match(editorialLinks, /className="world-editorial__grid"/);
});
