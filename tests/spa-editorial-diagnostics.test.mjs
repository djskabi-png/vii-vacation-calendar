import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../app/data/spaplus-catalog.json" with { type: "json" };
import { validateSpaEditorialCandidate, projectSpaViiSite } from "../app/lib/spa-editorial-policy.ts";
import { sanitizeCatalogDiagnostics, SpaEditorialReviewError } from "../app/lib/supplier-catalog-diagnostics.ts";

test("editorial rejection identifies every affected supplier and exact normalized fields without retaining prose", async () => {
  const sites = catalog.sites.slice(0, 3);
  const entries = sites.map((site, index) => ({ supplierId: site.id, summary: index === 0
    ? { ...site, about: ["private rejected prose"], opening: ["private opening"] }
    : index === 1 ? { ...site, address: "private address" } : site }));
  const before = JSON.stringify(entries);
  await assert.rejects(() => validateSpaEditorialCandidate(entries), (error) => {
    assert.ok(error instanceof SpaEditorialReviewError);
    assert.equal(error.message, "catalog_editorial_requires_review");
    assert.deepEqual(error.diagnostics.spaEditorialReview, { total: 2, truncated: false, rejected: [
      { supplierId: sites[0].id, fields: ["about", "opening"], reason: "content_changed" },
      { supplierId: sites[1].id, fields: ["address"], reason: "content_changed" },
    ] });
    assert.doesNotMatch(JSON.stringify(error.diagnostics), /private|prose|https|@/);
    return true;
  });
  assert.equal(JSON.stringify(entries), before);
});

test("commercial-only and already-projected updates remain accepted", async () => {
  const site = structuredClone(catalog.sites[0]);
  const projected = await projectSpaViiSite(site);
  await validateSpaEditorialCandidate([{ supplierId: site.id, summary: {
    ...projected, packages: projected.packages.map((pack) => ({ ...pack, price: pack.price + 10 })) } }]);
  await validateSpaEditorialCandidate([]);
});

test("diagnostic sanitizer rejects arbitrary field names, reasons and values and bounds history", () => {
  const raw = { total: 150, rejected: Array.from({ length: 150 }, (_, index) => ({
    supplierId: index + 1, fields: ["about", "about", "contact", "private-value", { secret: "private-value" }],
    reason: "content_changed", sourceText: "private-value" })), token: "private-value" };
  const result = sanitizeCatalogDiagnostics({ spaEditorialReview: raw });
  assert.equal(result.spaEditorialReview.total, 150);
  assert.equal(result.spaEditorialReview.rejected.length, 100);
  assert.equal(result.spaEditorialReview.truncated, true);
  assert.deepEqual(result.spaEditorialReview.rejected[0], { supplierId: 1, fields: ["about"], reason: "content_changed" });
  assert.doesNotMatch(JSON.stringify(result), /private|secret|token|contact|sourceText/);
  assert.equal(sanitizeCatalogDiagnostics({ oldUnknownField: "private-value" }), undefined);
  assert.equal(sanitizeCatalogDiagnostics({ spaEditorialReview: { total: -1, rejected: [] } }), undefined);
});

test("missing title produces safe diagnostics and multiple bad records cannot fail nondeterministically", async () => {
  const entry = { supplierId: 999999, summary: { id: 999999, title: "", city: "private city" } };
  await assert.rejects(() => validateSpaEditorialCandidate([entry]), (error) => {
    assert.deepEqual(error.diagnostics.spaEditorialReview, { total: 1, truncated: false,
      rejected: [{ supplierId: 999999, fields: ["title"], reason: "missing_title" }] });
    assert.doesNotMatch(JSON.stringify(error.diagnostics), /private city/);
    return true;
  });
});

test("large rejected candidates retain the true count but only the first hundred diagnostic records", async () => {
  const sites = catalog.sites.slice(0, 150);
  await assert.rejects(() => validateSpaEditorialCandidate(sites.map((site) => ({ supplierId: site.id,
    summary: { ...site, about: ["private changed text"] } }))), (error) => {
    const review = error.diagnostics.spaEditorialReview;
    assert.equal(review.total, 150);
    assert.equal(review.rejected.length, 100);
    assert.equal(review.truncated, true);
    assert.deepEqual(review.rejected.map((row) => row.supplierId), sites.slice(0, 100).map((site) => site.id));
    assert.doesNotMatch(JSON.stringify(review), /private changed text/);
    return true;
  });
});
