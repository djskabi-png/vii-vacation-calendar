import assert from "node:assert/strict";
import test from "node:test";
import { auditGalleryItem } from "../app/lib/gallery-api-audit.ts";

test("gallery audit reports ordered API mismatch", async () => {
  const result = await auditGalleryItem({
    world: "vacations", supplierId: 2728,
    api: { galleries: [{ galleryID: 1, pictures: ["a.jpg", "b.jpg"] }] },
    acceptedEntry: { supplierId: 2728, detail: { galleries: [{ galleryID: 1, pictures: ["b.jpg", "a.jpg"] }] } },
  });
  assert.equal(result.status, "mismatch");
  assert.ok(result.issues.some((issue) => issue.startsWith("image_order:")));
});

test("empty API and accepted payload remain unverified", async () => {
  const result = await auditGalleryItem({ world: "events", supplierId: 3, api: {}, acceptedEntry: { supplierId: 3, detail: {} } });
  assert.equal(result.status, "unverified");
  assert.ok(result.issues.includes("unknown_or_empty"));
});
