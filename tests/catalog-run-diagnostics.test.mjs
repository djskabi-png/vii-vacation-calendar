import assert from "node:assert/strict";
import { test } from "node:test";
import { readSupplierCatalogRunDiagnostics } from "../app/lib/supplier-catalog-store.ts";

function fakeDb(row) {
  const calls = [];
  return { calls, prepare(sql) {
    calls.push(sql);
    return { bind() { return this; }, async first() { return row; } };
  } };
}

test("run diagnostics reads one authorized row and strips unsafe payload fields", async () => {
  const db = fakeDb({ id: "run_1", world: "vacations", status: "rejected", diagnosticsJson: JSON.stringify({
    before: 5, candidate: 4, failure: { stage: "candidate_validation", category: "invalid_data", elapsedMs: 12, secret: "token" },
    addedIds: [1, 2], arbitrary: "do-not-return",
  }) });
  const result = await readSupplierCatalogRunDiagnostics(db, "vacations", "run_1");
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0], /WHERE id = \? AND world = \? LIMIT 1/);
  assert.equal(result.diagnosticsAvailable, true);
  assert.deepEqual(result.diagnostics, { before: 5, candidate: 4, failure: {
    stage: "candidate_validation", category: "invalid_data", elapsedMs: 12, retryable: false,
  }, addedIds: [1, 2], addedIdsTruncated: false });
  assert.equal("arbitrary" in result.diagnostics, false);
});

test("invalid run identity and missing row are fail-closed without a query", async () => {
  const db = fakeDb(null);
  assert.equal(await readSupplierCatalogRunDiagnostics(db, "vacations", "bad id"), null);
  assert.equal(db.calls.length, 0);
  assert.equal(await readSupplierCatalogRunDiagnostics(db, "vacations", "missing"), null);
  assert.equal(db.calls.length, 1);
});

test("empty or malformed stored diagnostics are reported as not stored", async () => {
  const db = fakeDb({ id: "run_2", world: "events", status: "failed", diagnosticsJson: "{not-json" });
  const result = await readSupplierCatalogRunDiagnostics(db, "events", "run_2");
  assert.equal(result.diagnosticsAvailable, false);
  assert.equal(result.diagnostics, undefined);
});
