import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("content queue filters by inclusive Israel date, demand and status", async () => {
  const { filterContentQueue, contentQueueRangeError } = await import("../app/lib/admin-content-queue-filters.ts");
  const items = [
    { title: "נופש בצפון", location: "צפון", world: "vacation", status: "pending", searches: 4, firstSeenAt: "2026-11-01T08:00:00Z", lastSeenAt: "2026-11-14T08:00:00Z" },
    { title: "ספא במרכז", location: "מרכז", world: "spa", status: "review", searches: 12, firstSeenAt: "2026-11-02T08:00:00Z", lastSeenAt: "2026-11-13T22:30:00Z" },
  ];
  const result = filterContentQueue(items, { query: "ספא", status: "review", world: "spa", from: "2026-11-14", to: "2026-11-14", minSearches: "12", maxSearches: "12" }, { vacation: "נופש", spa: "ספא" });
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "ספא במרכז");
  assert.match(contentQueueRangeError({ minSearches: "20", maxSearches: "5", from: "", to: "" }), /המינימלית/);
});

test("admin numbers link to their natural work queues", async () => {
  const highlights = await readFile(new URL("app/admin/admin-highlight-board.tsx", root), "utf8");
  const searchPages = await readFile(new URL("app/admin/search-pages/page.tsx", root), "utf8");
  const queueApi = await readFile(new URL("app/api/admin/content-queue/route.ts", root), "utf8");
  assert.match(highlights, /pending_pages[\s\S]*href: "\/admin\/content-queue"/);
  assert.match(searchPages, /status=active/);
  assert.match(searchPages, /status=existing/);
  assert.match(queueApi, /firstSeenAt: item\.firstSeenAt, lastSeenAt: item\.lastSeenAt/);
});
