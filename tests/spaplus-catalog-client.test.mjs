import assert from "node:assert/strict";
import { test } from "node:test";
import { createSpaPlusCatalogClient, normalizeSpaPlusCatalog } from "../app/lib/spaplus-catalog-client.ts";
import { SpaCatalogJsonError } from "../app/lib/supplier-catalog-diagnostics.ts";

const imageField = "CONCAT('https://www.spaplus.co.il/gallery/',picture)";
const payload = { status: "ok", sites: {
  42: {
    siteid: 42, title: "ספא בדיקה", titleEN: "Test Spa", city: "חיפה", address: "כתובת",
    about: "<p>שורה ראשונה</p><p>שורה שנייה</p>", phone: "03-1234567",
    spa_picture: "https://www.spaplus.co.il/gallery/place.jpg",
    iframeurl: "https://www.spaplus.co.il/order/42", opening: ["יום א"],
    packages: { a: {
      MainPageID: 7, idPack: 8, MainPageTitle: "חבילה זוגית", price: "399.5",
      treatmentDuration: "60", packPeoples: "2", isGroupPackage: "0",
      pack_picture: "https://www.spaplus.co.il/gallery/package.jpg",
      iframeurl: "https://www.spaplus.co.il/order/7",
    } },
  },
} };

test("normalizes a real-shaped spa site and package without inventing a dated offer", () => {
  const [entry] = normalizeSpaPlusCatalog(payload);
  assert.equal(entry.supplierId, 42);
  assert.deepEqual(entry.summary.about, ["שורה ראשונה", "שורה שנייה"]);
  assert.equal(entry.summary.packages[0].price, 399.5);
  assert.equal(entry.summary.packages[0].people, 2);
  assert.equal(entry.summary.image, "https://www.spaplus.co.il/gallery/place.jpg");
  assert.equal(entry.summary.packages[0].image, "https://www.spaplus.co.il/gallery/package.jpg");
  assert.equal(Object.hasOwn(entry.summary, "availability"), false);
});

test("accepts the previous supplier image field as a compatibility fallback", () => {
  const legacy = structuredClone(payload);
  legacy.sites[42][imageField] = legacy.sites[42].spa_picture;
  delete legacy.sites[42].spa_picture;
  legacy.sites[42].packages.a[imageField] = legacy.sites[42].packages.a.pack_picture;
  delete legacy.sites[42].packages.a.pack_picture;
  const [entry] = normalizeSpaPlusCatalog(legacy);
  assert.equal(entry.summary.image, "https://www.spaplus.co.il/gallery/place.jpg");
  assert.equal(entry.summary.packages[0].image, "https://www.spaplus.co.il/gallery/package.jpg");
});

test("fetches the supplier catalog with the provided key without exposing it in errors", async () => {
  const client = createSpaPlusCatalogClient({ apiKey: "private-test-key", fetchImpl: async (url) => {
    assert.equal(url.searchParams.get("key"), "private-test-key");
    assert.equal(url.searchParams.get("action"), "sites");
    return Response.json(payload);
  } });
  const result = await client.fetchCandidate();
  assert.equal(result.entries.length, 1);
  assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
  const bad = createSpaPlusCatalogClient({ apiKey: "private-test-key", fetchImpl: async () => new Response("", { status: 403 }) });
  await assert.rejects(() => bad.fetchCandidate(), (error) => error.message === "spa_not_authorized");
});

test("rejects malformed sites, packages and off-domain booking links", () => {
  assert.throws(() => normalizeSpaPlusCatalog({ ...payload, sites: [] }), /invalid_spa_catalog/);
  const changed = structuredClone(payload);
  changed.sites[42].packages.a.iframeurl = "https://example.com/order";
  assert.throws(() => normalizeSpaPlusCatalog(changed), /invalid_spa_url/);
});

test("valid JSON with an incorrect HTML content type or UTF-8 BOM still normalizes", async () => {
  for (const prefix of ["", "\ufeff"]) {
    const client = createSpaPlusCatalogClient({ apiKey: "private-test-key", fetchImpl: async () =>
      new Response(prefix + JSON.stringify(payload), { headers: { "Content-Type": "text/html; charset=utf-8" } }) });
    assert.equal((await client.fetchCandidate()).entries[0].supplierId, 42);
  }
});

test("JSON failures report only measured bytes, allowlisted media type and fixed categories", async () => {
  for (const [text, kind] of [[" \n<html>private-key owner@example.test https://private.invalid</html>", "html-like"],
    [" \n{\"private\":", "json-like"], ["  [private", "json-like"], ["private-body שלום", "other"], ["", "other"]]) {
    const client = createSpaPlusCatalogClient({ apiKey: "private-test-key", fetchImpl: async () =>
      new Response(text, { status: 200, headers: { "Content-Type": "text/html; key=private-key",
        Location: "https://private.invalid/?key=private-key" } }) });
    await assert.rejects(() => client.fetchCandidate(), (error) => {
      assert.ok(error instanceof SpaCatalogJsonError);
      assert.equal(error.message, "invalid_spa_response");
      assert.deepEqual(error.diagnostics, { spaJsonFailure: { httpStatus: 200, contentType: "text/html",
        responseBytes: new TextEncoder().encode(text).byteLength, firstCharacterKind: kind, parseErrorKind: "syntax_error" } });
      assert.doesNotMatch(JSON.stringify(error), /private|owner|https|Location|body|cause/);
      return true;
    });
  }
});

test("a failed body read cannot persist the partial body or exception message", async () => {
  const client = createSpaPlusCatalogClient({ apiKey: "private-test-key", fetchImpl: async () =>
    new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode("private-partial-body"));
      controller.error(new Error("private-key private-contact"));
    } }), { headers: { "Content-Type": "application/json" } }) });
  await assert.rejects(() => client.fetchCandidate(), (error) => {
    assert.deepEqual(error.diagnostics, { spaJsonFailure: { httpStatus: 200, contentType: "application/json",
      responseBytes: null, firstCharacterKind: "other", parseErrorKind: "body_read_error" } });
    assert.doesNotMatch(JSON.stringify(error), /private|partial|contact/);
    return true;
  });
});
