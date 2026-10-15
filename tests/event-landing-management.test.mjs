import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  defaultEventLandingPresentation,
  eventLandingSourceAttributes,
  parseEventLandingPresentation,
  validEventLandingAttributes,
} from "../app/lib/event-landing-presentation.ts";

test("event landing defaults provide a complete hero and visual discovery rail", () => {
  const presentation = parseEventLandingPresentation(null);
  assert.equal(presentation.heroImages.length, 3);
  assert.ok(presentation.heroImages.every((image) => image.src && image.alt));
  assert.ok(presentation.quickSearches.length >= 4);
  assert.ok(presentation.quickSearches.every((item) => item.href.startsWith("/events/") && item.image && item.imageAlt));
});

test("event landing management accepts safe complete presentation data and rejects unsafe destinations", () => {
  const attributes = eventLandingSourceAttributes();
  assert.equal(validEventLandingAttributes(attributes), true);
  const items = JSON.parse(attributes.eventQuickSearches);
  items[0].href = "https://unrelated.example/search";
  assert.equal(validEventLandingAttributes({ ...attributes, eventQuickSearches: JSON.stringify(items) }), false);
  assert.equal(validEventLandingAttributes({ ...attributes, eventHeroImage1Alt: "" }), false);
});

test("content studio seeds and exposes the events landing as a versioned public control", async () => {
  const [inventory, editor, route, page] = await Promise.all([
    readFile(new URL("../app/lib/content-studio-inventory.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/content-studio/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/content-studio/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/events/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(inventory, /type: "events", key: "landing"/);
  assert.match(inventory, /key === "landing" \? "\/events"/);
  assert.match(editor, /עמוד הפתיחה של עולם האירועים/);
  assert.match(editor, /הוספת חיפוש מהיר/);
  assert.match(route, /validEventLandingAttributes/);
  assert.match(page, /readEventLandingPresentation/);
  assert.match(page, /presentation\.heroImages\.map/);
  assert.match(page, /<EventQuickSearches/);
  assert.equal(defaultEventLandingPresentation.quickSearches.length, 6);
});
