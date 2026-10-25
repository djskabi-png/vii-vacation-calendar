import assert from "node:assert/strict";
import test from "node:test";
import { mergeBusinessPerformanceRows } from "../app/lib/business-performance-rows.ts";

test("business selector receives one canonical row when singular and plural world aliases coexist", () => {
  const rows = mergeBusinessPerformanceRows(
    [{ placeId: "vacation-116", placeName: "עסק", world: "vacations" }],
    [{ placeId: "vacation-116", placeName: "עסק", world: "vacation", pageViews: 4 }],
    [{ placeId: "vacation-116", placeName: "עסק", world: "vacations", pageViews: 3 }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].world, "vacations");
  assert.equal(rows[0].pageViews, 7);
});

test("different place ids remain separate", () => {
  const rows = mergeBusinessPerformanceRows([
    { placeId: "vacation-116", placeName: "א", world: "vacations" },
    { placeId: "vacation-117", placeName: "ב", world: "vacation" },
  ]);
  assert.deepEqual(rows.map((row) => row.placeId).sort(), ["vacation-116", "vacation-117"]);
});
