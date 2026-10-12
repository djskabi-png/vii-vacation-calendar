import assert from "node:assert/strict";
import test from "node:test";
import { dailyRotationCompare, rotateDaily, rotateWithinTiers } from "../app/lib/daily-rotation.ts";

const items = Array.from({ length: 30 }, (_, index) => ({ id: `place-${index}`, tier: index % 3 }));

test("daily rotation is stable for a day and independent of supplier order", () => {
  const first = rotateDaily(items, (item) => item.id, "spa-home", "2026-10-12");
  const again = rotateDaily([...items].reverse(), (item) => item.id, "spa-home", "2026-10-12");
  const tomorrow = rotateDaily(items, (item) => item.id, "spa-home", "2026-10-13");
  assert.deepEqual(first, again);
  assert.notDeepEqual(first, tomorrow);
  assert.deepEqual(first.map((item) => item.id).sort(), items.map((item) => item.id).sort());
});

test("daily rotation never moves a lower-priority tier above a better tier", () => {
  const ordered = rotateWithinTiers(items, (item) => item.tier, (item) => item.id, "vacation-search", "2026-10-12");
  assert.deepEqual(ordered.map((item) => item.tier), [...items.map((item) => item.tier)].sort());
  assert.equal(dailyRotationCompare("place-1", "place-2", "a", "2026-10-12"),
    -dailyRotationCompare("place-2", "place-1", "a", "2026-10-12"));
});
