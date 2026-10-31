import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogContentIntegrityIssues } from "../app/lib/supplier-catalog-sync.ts";

function entry() {
  return {
    supplierId: 17,
    summary: { slug: "vacation-17", name: "מתחם בדיקה" },
    detail: {
      images: ["/api/vii/media/a.jpg", "/api/vii/media/b.jpg"],
      galleryGroups: [
        { title: "המתחם", images: ["/api/vii/media/a.jpg"] },
        { title: "הסוויטה", images: ["/api/vii/media/b.jpg"] },
      ],
      features: ["בריכה", "חניה"],
      featureGroups: [{ title: "מתקני חוץ", items: ["בריכה"] }],
      rooms: [{ id: 55, name: "סוויטה", images: ["/api/vii/media/b.jpg"],
        features: ["מיטה זוגית"], featureGroups: [{ title: "חדר שינה", items: ["מיטה זוגית"] }] }],
    },
  };
}

test("identical and additive vacation content passes the canonical integrity guard", () => {
  const before = entry();
  const identical = structuredClone(before);
  assert.deepEqual(catalogContentIntegrityIssues("vacations", [before], [identical]), []);
  const additive = structuredClone(before);
  additive.detail.images.push("/api/vii/media/c.jpg");
  additive.detail.galleryGroups.push({ title: "הבריכה", images: ["/api/vii/media/c.jpg"] });
  additive.detail.rooms[0].features.push("מסך LCD");
  assert.deepEqual(catalogContentIntegrityIssues("vacations", [before], [additive]), []);
});

test("partial supplier responses cannot erase accepted galleries, groups or rooms", () => {
  for (const mutate of [
    (next) => { next.detail.images = []; },
    (next) => { next.detail.galleryGroups = []; },
    (next) => { next.detail.galleryGroups[1].images = []; },
    (next) => { next.detail.features = []; },
    (next) => { next.detail.featureGroups = []; },
    (next) => { next.detail.rooms = []; },
    (next) => { next.detail.rooms[0].images = []; },
    (next) => { next.detail.rooms[0].features = []; },
    (next) => { next.detail.rooms[0].featureGroups = []; },
  ]) {
    const before = entry();
    const next = structuredClone(before);
    mutate(next);
    assert.ok(catalogContentIntegrityIssues("vacations", [before], [next]).length > 0);
    assert.ok(catalogContentIntegrityIssues("events", [before], [next]).length > 0);
  }
});

test("removing one accepted image or supplier gallery group requires review", () => {
  const before = entry();
  const removedImage = structuredClone(before);
  removedImage.detail.images.pop();
  assert.ok(catalogContentIntegrityIssues("vacations", [before], [removedImage])
    .some((issue) => issue.path === "detail.images" && issue.reason === "item_removed"));
  const removedGroup = structuredClone(before);
  removedGroup.detail.galleryGroups.pop();
  assert.ok(catalogContentIntegrityIssues("events", [before], [removedGroup])
    .some((issue) => issue.path.includes("הסוויטה") && issue.reason === "item_removed"));
});

test("non Sergey worlds keep their existing dedicated guards", () => {
  const before = entry();
  const empty = structuredClone(before);
  empty.detail = {};
  assert.deepEqual(catalogContentIntegrityIssues("spa", [before], [empty]), []);
  assert.deepEqual(catalogContentIntegrityIssues("rooms", [before], [empty]), []);
});
