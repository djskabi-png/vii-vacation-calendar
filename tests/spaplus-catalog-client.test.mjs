import assert from "node:assert/strict";
import { test } from "node:test";
import { createSpaPlusCatalogClient, normalizeSpaPlusCatalog } from "../app/lib/spaplus-catalog-client.ts";

const imageField = "CONCAT('https://www.spaplus.co.il/gallery/',picture)";
const payload = { status: "ok", sites: {
  42: {
    siteid: 42, title: "ספא בדיקה", titleEN: "Test Spa", city: "חיפה", address: "כתובת",
    about: "<p>שורה ראשונה</p><p>שורה שנייה</p>", phone: "03-1234567",
    [imageField]: "https://www.spaplus.co.il/gallery/place.jpg",
    iframeurl: "https://www.spaplus.co.il/order/42", opening: ["יום א"],
    packages: { a: {
      MainPageID: 7, idPack: 8, MainPageTitle: "חבילה זוגית", price: "399.5",
      treatmentDuration: "60", packPeoples: "2", isGroupPackage: "0",
      [imageField]: "https://www.spaplus.co.il/gallery/package.jpg",
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
  assert.equal(Object.hasOwn(entry.summary, "availability"), false);
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
