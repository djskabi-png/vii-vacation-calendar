import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../app/data/verified-catalog.json" with { type: "json" };
import { activityRegion, activityType, activityRegions, activityTypes, activityMatchesTopic } from "../app/lib/activity-discovery-taxonomy.ts";

test("verified attractions map to supported regions", () => {
  assert.equal(catalog.attractions.length, 15);
  for (const item of catalog.attractions) assert.ok(activityRegions.includes(activityRegion(item)), `${item.id} has no supported region`);
});

test("verified attractions use explicit supported categories", () => {
  for (const item of catalog.attractions) assert.ok(activityTypes.includes(activityType(item)), `${item.id} has no verified category`);
});

test("actual city/region records cannot be confused with activity categories", () => {
  const museum = catalog.attractions.find(item => item.id === "tel-aviv-museum");
  assert.equal(museum.area, "מרכז");
  assert.equal(activityRegion(museum), "מרכז ותל אביב");
  assert.equal(activityType(museum), "אוכל ותרבות");
  assert.equal(activityMatchesTopic(museum, { area: "מרכז ותל אביב", type: "אוכל ותרבות" }), true);
  assert.equal(activityMatchesTopic(museum, { area: "צפון" }), false);
  assert.equal(activityType({ id: "unknown", area: "מרכז" }), null);
  assert.equal(activityType({ id: "managed", area: "טבע ורכיבה" }), "טבע ורכיבה");
});
