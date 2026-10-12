import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeCatalogDiagnostics, catalogInventoryDiagnostics, SupplierCatalogRedirectError } from "../app/lib/supplier-catalog-diagnostics.ts";

test("diagnostics have exact total counts, bounded ID lists and explicit truncation", () => {
  const previous = Array.from({ length: 150 }, (_, i) => ({ supplierId: i + 1, detail: { rooms: [{ id: i + 501 }] }, summary: { contact: "private" } }));
  const candidate = Array.from({ length: 150 }, (_, i) => ({ supplierId: i + 1001, detail: { rooms: [{ id: i + 2001 }] }, summary: { key: "private" } }));
  const diagnostics = catalogInventoryDiagnostics("vacations", previous, candidate, 0);
  assert.equal(diagnostics.before, 150);
  assert.equal(diagnostics.candidate, 150);
  assert.equal(diagnostics.addedCount, 150);
  assert.equal(diagnostics.removedCount, 150);
  assert.equal(diagnostics.addedIds.length, 100);
  assert.equal(diagnostics.removedIds.length, 100);
  assert.equal(diagnostics.units.removed.length, 100);
  assert.equal(diagnostics.units.removedWithPlaces, 150);
  assert.equal(diagnostics.units.removedTotal, 150);
  assert.equal(diagnostics.addedIdsTruncated, true);
  assert.equal(diagnostics.removedIdsTruncated, true);
  assert.equal(diagnostics.units.truncated, true);
  assert.doesNotMatch(JSON.stringify(diagnostics), /private|contact|"key"/);
  assert.ok(new TextEncoder().encode(JSON.stringify(diagnostics)).length < 16_384);
});

test("diagnostic write/read sanitizer strips unknown properties and rejects URL-shaped hostnames", () => {
  const value = sanitizeCatalogDiagnostics({ before: 4, candidate: 3, removedIds: [1, "private", -1],
    token: "private-token", contact: "private-phone", redirect: { status: 302,
      hostname: "abuse.spd.co.il?key=private-key", location: "https://private.invalid/?key=private" } });
  assert.deepEqual(value, { before: 4, candidate: 3, removedIds: [1], removedIdsTruncated: false,
    redirect: { status: 302, hostname: null } });
  assert.doesNotMatch(JSON.stringify(value), /private|token|contact|location/);
  assert.equal(sanitizeCatalogDiagnostics({ phone: "private" }), undefined);
});

test("missing or malformed Location cannot expose the supplier URL or key", () => {
  for (const location of [null, "http://[invalid"]) {
    const error = new SupplierCatalogRedirectError("spa_redirect_not_allowed", 302, location,
      "https://www.spaplus.co.il/vii/?key=private-key");
    assert.equal(error.message, "spa_redirect_not_allowed");
    assert.deepEqual(error.diagnostics, { redirect: { status: 302, hostname: null } });
    assert.doesNotMatch(JSON.stringify(error), /private|\?/);
  }
});

test("spa JSON metadata sanitizer never retains headers, body, secrets or error text", () => {
  const diagnostics = sanitizeCatalogDiagnostics({ spaJsonFailure: { httpStatus: 200,
    contentType: "text/html; key=private-key", responseBytes: 1234,
    firstCharacterKind: "html-like", parseErrorKind: "syntax_error", body: "private-body", prefix: "private-prefix",
    headers: { Authorization: "private-token" }, Location: "https://private.invalid/?key=private-key", message: "private-error" } });
  assert.deepEqual(diagnostics, { spaJsonFailure: { httpStatus: 200, contentType: "text/html", responseBytes: 1234,
    firstCharacterKind: "html-like", parseErrorKind: "syntax_error" } });
  assert.doesNotMatch(JSON.stringify(diagnostics), /private|prefix|headers|Authorization|Location|message/);
  assert.deepEqual(sanitizeCatalogDiagnostics({ spaJsonFailure: { httpStatus: 200, contentType: "private-content-type",
    responseBytes: -1, firstCharacterKind: "private-char", parseErrorKind: "private-error" } }),
  { spaJsonFailure: { httpStatus: 200, contentType: "other", responseBytes: null,
    firstCharacterKind: "other", parseErrorKind: "other" } });
  assert.equal(sanitizeCatalogDiagnostics({ spaJsonFailure: { httpStatus: 999 } }), undefined);
});
