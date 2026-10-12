import assert from "node:assert/strict";
import { test } from "node:test";
import { readBaseline, summarizeWorld } from "../scripts/catalog-sync-baseline.mjs";

const now = new Date("2026-10-12T12:00:00.000Z");

test("summarizes the four existing supplier snapshots without credentials", async () => {
  const worlds = await readBaseline();
  assert.deepEqual(worlds.map(({ world }) => world), ["vacations", "events", "rooms", "spa"]);
  assert.ok(worlds.every(({ count, ageHours, ids }) => count > 0 && ageHours >= 0 && ids.length === count));
  assert.ok(worlds.every(({ withImages, count }) => withImages <= count));
});

test("rejects duplicate supplier records before they become a sync baseline", () => {
  const catalog = {
    fetchedAt: "2026-10-12T10:00:00.000Z",
    places: [{ supplierId: 1, images: [] }, { supplierId: 1, images: [] }],
  };
  assert.throws(() => summarizeWorld("rooms", catalog, now), /duplicate supplier IDs/);
});

test("rejects an empty or future-dated snapshot", () => {
  assert.throws(() => summarizeWorld("rooms", { fetchedAt: now.toISOString(), places: [] }, now), /missing entries/);
  assert.throws(() => summarizeWorld("rooms", { fetchedAt: "2026-10-13T00:00:00Z", places: [{ supplierId: 1 }] }, now), /timestamp/);
});
