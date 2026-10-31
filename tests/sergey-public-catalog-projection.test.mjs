import test from "node:test";
import assert from "node:assert/strict";
import { canonicalSergeyAmenityLabel } from "../app/lib/sergey-amenities.ts";
import { projectSergeyPublicCatalogValue } from "../app/lib/sergey-public-catalog-projection.ts";

test("canonical supplier terminology replaces the stale heated-pool label", () => {
  assert.equal(canonicalSergeyAmenityLabel("בריכת שחיה מרעננת"), "בריכת שחיה מחוממת");
  assert.equal(canonicalSergeyAmenityLabel("חניה פרטית"), "חניה פרטית");
});

test("accepted summary, detail, groups and rooms use the same canonical labels", () => {
  const source = {
    summary: { features: ["בריכת שחיה מרעננת"] },
    detail: {
      features: ["בריכת שחיה מרעננת"],
      featureGroups: [{ title: "מתקנים נוספים", items: ["בריכת שחיה מרעננת"] }],
      rooms: [{ features: ["בריכת שחיה מרעננת"], featureGroups: [{ title: "בחדר", items: ["בריכת שחיה מרעננת"] }] }],
    },
  };
  const result = projectSergeyPublicCatalogValue(source);
  assert.doesNotMatch(JSON.stringify(result), /בריכת שחיה מרעננת/);
  assert.equal(result.summary.features[0], "בריכת שחיה מחוממת");
  assert.equal(result.detail.featureGroups[0].items[0], "בריכת שחיה מחוממת");
  assert.equal(result.detail.rooms[0].featureGroups[0].items[0], "בריכת שחיה מחוממת");
  assert.equal(source.summary.features[0], "בריכת שחיה מרעננת", "projection must not mutate accepted supplier rows");
});

test("accepted summary and nested detail media use the local proxy", () => {
  const result = projectSergeyPublicCatalogValue({
    summary: { image: "https://www.vii.co.il/gallery/a.jpg", images: ["https://www.vii.co.il/gallery/a.jpg"] },
    detail: { images: ["https://www.vii.co.il/gallery/b.jpg"], rooms: [{ images: ["https://www.vii.co.il/gallery/c.jpg"] }] },
  });
  assert.equal(result.summary.image, "/api/vii/media/a.jpg");
  assert.deepEqual(result.summary.images, ["/api/vii/media/a.jpg"]);
  assert.deepEqual(result.detail.images, ["/api/vii/media/b.jpg"]);
  assert.deepEqual(result.detail.rooms[0].images, ["/api/vii/media/c.jpg"]);
});
