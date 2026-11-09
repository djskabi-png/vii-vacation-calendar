import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { applyGalleryAuditWorld } from "../app/lib/gallery-audit-apply.ts";

const jobId = "11111111-1111-4111-8111-111111111111";
const applyKey = `vii-gallery-audit/v1/${jobId}/apply/vacations.json`;
function object(value, etag = "etag-1") {
  return { etag, async text() { return JSON.stringify(value); } };
}
function bucketFor(entries) {
  const writes = [];
  return {
    writes,
    async get(key) { return entries[key] ?? null; },
    async put(key, value, options) { writes.push({ key, value, options }); return { etag: "new-etag" }; },
  };
}

test("reserved apply receipt is returned without database or bucket mutation", async () => {
  const receipt = { world: "vacations", jobId, runId: "r", state: "reserved", changed: 0, skipped: 0, verified: 0, verificationIssues: [] };
  const bucket = bucketFor({ [applyKey]: object(receipt) });
  const db = new Proxy({}, { get() { throw new Error("database_mutation_or_read"); } });
  const result = await applyGalleryAuditWorld({ db, bucket, jobId, world: "vacations" });
  assert.deepEqual(result, receipt);
  assert.equal(bucket.writes.length, 0);
});

test("incomplete audit job is rejected before applying catalog changes", async () => {
  const jobKey = `vii-gallery-audit/v1/${jobId}/job.json`;
  const bucket = bucketFor({ [jobKey]: object({ jobId, state: "complete", total: 2, completed: 1, results: [], worldCounts: { vacations: 1, events: 0, rooms: 0, spa: 0 }, cursor: 1, deadline: new Date(Date.now() + 10000).toISOString(), sourceIssues: [] }) });
  await assert.rejects(() => applyGalleryAuditWorld({ db: {}, bucket, jobId, world: "vacations" }), /gallery_audit_not_complete/);
  assert.equal(bucket.writes.length, 0);
});

test("admin route validates apply world against the four supported worlds", () => {
  const source = fs.readFileSync(new URL("../app/api/admin/gallery-audit/route.ts", import.meta.url), "utf8");
  assert.match(source, /\["vacations", "events", "rooms", "spa"\]\.includes\(String\(body\.world\)\)/);
  assert.match(source, /stepBoundedGalleryApply\(input\)/);
  assert.match(source, /startBoundedGalleryApply\(/);
  assert.doesNotMatch(source, /applyGalleryAuditWorld\(/, "the public admin route must never invoke a full-world in-memory apply");
});
