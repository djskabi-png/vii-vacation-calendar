import assert from "node:assert/strict";
import { test } from "node:test";
import { scheduledCatalogWorld } from "../app/lib/supplier-catalog-schedule.ts";

test("catalog schedule keeps the approved Israel slots in winter and summer", () => {
  const slots = [
    ["05:00", "vacations"], ["05:30", "events"], ["06:00", "rooms"], ["06:30", "spa"],
    ["12:00", "vacations"], ["12:30", "events"], ["13:00", "rooms"], ["13:30", "spa"],
    ["17:00", "vacations"], ["17:30", "events"], ["18:00", "rooms"], ["18:30", "spa"],
  ];
  for (const [month, offset] of [["01", 2], ["07", 3]]) {
    for (const [time, world] of slots) {
      const [hour, minute] = time.split(":").map(Number);
      const utc = new Date(Date.UTC(2026, Number(month) - 1, 15, hour - offset, minute));
      assert.equal(scheduledCatalogWorld(utc), world, `${month} ${time}`);
    }
    assert.equal(scheduledCatalogWorld(new Date(Date.UTC(2026, Number(month) - 1, 15, 7, 0))), null);
  }
  assert.equal(scheduledCatalogWorld(new Date(NaN)), null);
});
