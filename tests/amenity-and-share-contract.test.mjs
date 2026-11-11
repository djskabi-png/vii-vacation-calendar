import assert from "node:assert/strict";
import test from "node:test";
import { amenityPresentation } from "../app/lib/amenity-presentation.ts";
import { canonicalShareUrl } from "../app/lib/share-url.ts";

test("amenity presentation keeps the full verified list and one five-item limit", () => {
  const items = Array.from({ length: 15 }, (_, i) => `מאפיין ${i}`);
  assert.equal(amenityPresentation(items, "mobile").visible.length, 5);
  assert.equal(amenityPresentation(items, "desktop").visible.length, 5);
  assert.equal(amenityPresentation(items, "mobile").all.length, 15);
  assert.equal(amenityPresentation(items, "mobile", true).visible.length, 15);
});

test("event share keeps the canonical place URL and strips tracking state", () => {
  assert.equal(canonicalShareUrl("https://vii.spaplus.co/events/place/event-123?from=2026-11-11&sort=nearest", "event"), "https://vii.spaplus.co/events/place/event-123");
  assert.equal(canonicalShareUrl("https://vii.spaplus.co/business?id=vacation-1296&from=2026-11-11", "place"), "https://vii.spaplus.co/business?id=vacation-1296");
});
