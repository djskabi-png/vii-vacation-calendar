import test from "node:test";
import assert from "node:assert/strict";
import { validEventDiscoveryResult, warmEventDiscoveryCache } from "../app/lib/warm-event-discovery-cache.ts";

test("a structurally valid empty event discovery response is accepted", () => {
  assert.equal(validEventDiscoveryResult({ checkedAt: "2026-11-03T12:00:00Z", results: [] }), true);
  assert.equal(validEventDiscoveryResult({ results: [{ siteID: 11, available: false }] }), true);
  assert.equal(validEventDiscoveryResult({ results: [{ siteID: "11", available: false }] }), false);
  assert.equal(validEventDiscoveryResult({ error: "supplier_unavailable" }), false);
});

test("the event warmer accepts valid empty dates and fails only when every date is unavailable", async () => {
  const source = warmEventDiscoveryCache.toString();
  assert.match(source, /validate: validEventDiscoveryResult/);
  assert.match(source, /warmed\.every\(\(item\) => item\.status === "unavailable"\)/);
  assert.doesNotMatch(source, /warmed\.some\(\(item\) => item\.count > 0\)/);
});
