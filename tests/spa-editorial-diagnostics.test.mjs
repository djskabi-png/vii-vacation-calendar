import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../app/data/spaplus-catalog.json" with { type: "json" };
import { validateSpaEditorialCandidate, projectSpaViiSite } from "../app/lib/spa-editorial-policy.ts";
import { sanitizeCatalogDiagnostics } from "../app/lib/supplier-catalog-diagnostics.ts";

test("reviewed supplier changes preserve VII copy instead of rejecting the whole catalog", async () => {
  const sites = catalog.sites.slice(0, 3);
  const entries = sites.map((site, index) => ({ supplierId: site.id, summary: index === 0
    ? { ...site, about: ["private rejected prose"], opening: ["private opening"] }
    : index === 1 ? { ...site, address: "private address" } : site }));
  const before = JSON.stringify(entries);
  await validateSpaEditorialCandidate(entries);
  const projected = await projectSpaViiSite(entries[0].summary);
  assert.doesNotMatch(JSON.stringify({about:projected.about,shortDescription:projected.shortDescription}), /private rejected prose/);
  assert.deepEqual(projected.opening, ["private opening"]);
  assert.equal(JSON.stringify(entries), before);
});

test("commercial-only and already-projected updates remain accepted", async () => {
  const site = structuredClone(catalog.sites[0]);
  const projected = await projectSpaViiSite(site);
  await validateSpaEditorialCandidate([{ supplierId: site.id, summary: {
    ...projected, packages: projected.packages.map((pack) => ({ ...pack, price: pack.price + 10 })) } }]);
  await validateSpaEditorialCandidate([]);
});

test("an orphan supplier cover is replaced by the first approved gallery image", async () => {
  const site = structuredClone(catalog.sites[0]);
  const gallery = ["https://www.spaplus.co.il/gallery/working-cover.jpeg", ...(site.gallery || [])];
  const projected = await projectSpaViiSite({ ...site,
    image: "https://www.spaplus.co.il/gallery/orphan-cover.jpeg", gallery });
  assert.equal(projected.image, gallery[0]);
  assert.equal(site.image, catalog.sites[0].image);
});

test("unavailable supplier media is removed and the first approved gallery image becomes the cover", async () => {
  const unavailable = [
    "https://www.spaplus.co.il/gallery/1775671890054446.jpeg",
    "https://www.spaplus.co.il/gallery/1775671890081933.jpeg",
  ];
  const approved = "https://www.spaplus.co.il/gallery/1775671890040425.jpeg";
  const site = { id: 534, title: "Spa", city: "Nahariya", image: unavailable[0],
    gallery: [...unavailable, approved], packages: [] };
  const before = structuredClone(site);
  const projected = await projectSpaViiSite(site);
  assert.equal(projected.image, approved);
  assert.deepEqual(projected.gallery, [approved]);
  assert.deepEqual(site, before);
});

test("an approved supplier cover and gallery remain unchanged", async () => {
  const approved = "https://www.spaplus.co.il/gallery/1775671890040425.jpeg";
  const site = { id: 534, title: "Spa", city: "Nahariya", image: approved,
    gallery: [approved], packages: [] };
  const projected = await projectSpaViiSite(site);
  assert.equal(projected.image, approved);
  assert.deepEqual(projected.gallery, [approved]);
});

test("a spa with only unavailable media exposes no broken cover", async () => {
  const unavailable = "https://www.spaplus.co.il/gallery/1775671890054446.jpeg";
  const projected = await projectSpaViiSite({ id: 534, title: "Spa", city: "Nahariya",
    image: unavailable, gallery: [unavailable], packages: [] });
  assert.equal(projected.image, undefined);
  assert.deepEqual(projected.gallery, []);
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

test("content integrity diagnostics preserve safe numeric room paths and reject provider paths", () => {
  const result = sanitizeCatalogDiagnostics({ contentIntegrity: { total: 5, issues: [
    { supplierId: 12, path: "detail.rooms.40.images", reason: "item_removed" },
    { supplierId: 12, path: "detail.galleryGroups.images", reason: "collection_missing" },
    { supplierId: 12, path: "detail.rooms.99999999999.images", reason: "item_removed" },
    { supplierId: 12, path: "detail.galleryGroups.Private Villa", reason: "item_removed" },
    { supplierId: 12, path: "https://provider.invalid/secret", reason: "item_removed" },
  ], truncated: false } });
  assert.deepEqual(result.contentIntegrity, { total: 5, truncated: false, issues: [
    { supplierId: 12, path: "detail.rooms.40.images", reason: "item_removed" },
    { supplierId: 12, path: "detail.galleryGroups.images", reason: "collection_missing" },
  ] });
  assert.doesNotMatch(JSON.stringify(result), /Private Villa|provider\.invalid|secret/);
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
  const sites = Array.from({length:150},(_,index)=>({id:900000+index,title:"",city:"private city"}));
  await assert.rejects(() => validateSpaEditorialCandidate(sites.map((site) => ({ supplierId: site.id, summary: site }))), (error) => {
    const review = error.diagnostics.spaEditorialReview;
    assert.equal(review.total, 150);
    assert.equal(review.rejected.length, 100);
    assert.equal(review.truncated, true);
    assert.deepEqual(review.rejected.map((row) => row.supplierId), sites.slice(0, 100).map((site) => site.id));
    assert.doesNotMatch(JSON.stringify(review), /private city/);
    return true;
  });
});
