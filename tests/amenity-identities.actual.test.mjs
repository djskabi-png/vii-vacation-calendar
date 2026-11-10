import assert from "node:assert/strict";
import test from "node:test";
import { cachedAmenityTaxonomy, cachedSharedAmenityList } from "../app/lib/business-amenities-cache.ts";
import { buildSergeyAmenityIndex, canonicalSergeyAmenityLabel, sergeyAmenityGroups } from "../app/lib/sergey-amenities.ts";

function transport(payload) {
  return async () => new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
}

test("actual supplier identity forms survive taxonomy, cache and group normalization", async () => {
  const taxonomy = await cachedAmenityTaxonomy({
    token: "test-identity-forms",
    sourceRevision: "actual-identity-forms-1",
    db: null,
    fetchImpl: transport({
      amenity_categories: [{ categoryID: "9", categoryName: "מתקנים", order: "1" }],
      amenities: [
        { id: "123", title: "בריכה", categoryID: "9", orderInCategory: "1" },
        { id: "124", title: "סאונה", categoryID: "9", orderInCategory: "2" },
        { id: "125", title: "ג׳קוזי", categoryID: "9", orderInCategory: "3" },
      ],
    }),
  });
  const index = buildSergeyAmenityIndex(taxonomy.value);
  assert.deepEqual([...index.amenities.keys()], [123, 124, 125]);
  assert.deepEqual([...buildSergeyAmenityIndex({
    amenity_categories: [{ categoryID: "9", categoryName: "מתקנים" }],
    amenities: [{ id: "-1", title: "פסול" }, { id: "1.5", title: "פסול נוסף" }, { id: "9007199254740993", title: "פסול גדול" }],
  }).amenities.keys()], []);

  const list = await cachedSharedAmenityList({
    token: "test-identity-forms",
    sourceRevision: "actual-identity-forms-1",
    db: null,
    fetchImpl: transport({ places: [{ siteID: "2728", shared_amenities: ["123", { amenityID: "124" }, { amenityId: "125", shown: false }] }] }),
  });
  assert.deepEqual(list.value["2728"], ["123", { id: "124" }, { id: "125", shown: false }]);
  assert.deepEqual(sergeyAmenityGroups(list.value["2728"], index), [{ title: "מתקנים", items: ["בריכה", "סאונה"] }]);
  assert.equal(canonicalSergeyAmenityLabel("בריכת שחיה מרעננת"), "בריכת שחיה מחוממת");
});
