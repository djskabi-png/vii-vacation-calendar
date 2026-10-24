import test from "node:test";
import assert from "node:assert/strict";
import { homepageContentInventory } from "../app/data/homepage-content-inventory.ts";

test("homepage administration inventory classifies every public section once", () => {
  const expected = ["hero", "popular", "availability", "holidays", "vacation-discovery", "videos", "hourly", "events", "worlds", "ratings", "gift-corporate", "destinations", "magazine", "trails"];
  assert.deepEqual(homepageContentInventory.map((item) => item.id), expected);
  assert.equal(new Set(homepageContentInventory.map((item) => item.id)).size, expected.length);
  assert.ok(homepageContentInventory.every((item) => item.label && item.owner && item.mode));
});
