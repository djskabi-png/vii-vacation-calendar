import assert from "node:assert/strict";
import { test } from "node:test";
import { businessReportScopes, canonicalBusinessReportScope } from "../app/lib/business-report-scopes.ts";

test("business performance exposes the complete stable family registry", () => {
  assert.deepEqual(businessReportScopes, ["all", "vacations", "events", "spa", "rooms", "activities", "trails", "providers"]);
});

test("raw world aliases map to one canonical report family", () => {
  const expected = {
    vacation: "vacations", vacations: "vacations",
    event: "events", events: "events",
    hourly: "rooms", room: "rooms", rooms: "rooms",
    attractions: "activities", activities: "activities",
    spa: "spa", trails: "trails", providers: "providers",
  };
  for (const [raw, canonical] of Object.entries(expected)) assert.equal(canonicalBusinessReportScope(raw), canonical);
});
