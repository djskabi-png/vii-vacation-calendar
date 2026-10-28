import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildSergeyAmenityIndex, sergeyAmenityGroups } from "../app/lib/sergey-amenities.ts";
import { fetchLiveBusinessAmenities } from "../app/lib/live-business-amenities.ts";
import { businessAmenitiesResponse } from "../app/api/vii/business-amenities/route.ts";

test("official category and item order wins over shuffled shared amenity input", () => {
  const index = buildSergeyAmenityIndex({
    amenity_categories: [
      { categoryID: 20, categoryName: "מתחם חיצוני" },
      { categoryID: 10, categoryName: "מתחם פנימי" },
    ],
    amenities: [
      { id: 3, categoryID: 10, title: "נטפליקס", orderInCategory: 2 },
      { id: 2, categoryID: 20, title: "פינת אוכל", orderInCategory: 2 },
      { id: 1, categoryID: 20, title: "בריכת שחייה", orderInCategory: 1 },
      { id: 4, categoryID: 10, title: "מזגן", orderInCategory: 1 },
    ],
  });
  assert.deepEqual(sergeyAmenityGroups([{ id: 3 }, { id: 2 }, { id: 4 }, { id: 1 }], index), [
    { title: "מתחם חיצוני", items: ["בריכת שחייה", "פינת אוכל"] },
    { title: "מתחם פנימי", items: ["מזגן", "נטפליקס"] },
  ]);
});

test("live business amenities use shared amenities only and never room amenities", async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer secret");
    const path = new URL(url).pathname;
    if (path.endsWith("/vacations/2483")) return Response.json({
      id: 2483,
      active: true,
      shared_amenities: [{ id: 1 }],
      rooms: [{ amenities: [{ id: 2 }] }],
    });
    if (path.endsWith("/vacations/types")) return Response.json({
      amenity_categories: [{ categoryID: 1, categoryName: "מתחם חיצוני" }, { categoryID: 2, categoryName: "אבזור החדר" }],
      amenities: [{ id: 1, categoryID: 1, title: "בריכה" }, { id: 2, categoryID: 2, title: "מיטה זוגית" }],
    });
    return new Response("missing", { status: 404 });
  };
  assert.deepEqual(await fetchLiveBusinessAmenities({ supplierId: 2483, token: "secret", fetchImpl }), [
    { title: "מתחם חיצוני", items: ["בריכה"] },
  ]);
});

test("public endpoint validates input, returns a cacheable source contract and fails honestly", async () => {
  const ok = await businessAmenitiesResponse(new Request("https://vii.test/api/vii/business-amenities?id=2483"), {
    token: async () => "secret",
    load: async () => [{ title: "מתחם חיצוני", items: ["בריכה"] }],
  });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("cache-control"), /s-maxage=21600/);
  assert.deepEqual(await ok.json(), { supplierId: 2483, groups: [{ title: "מתחם חיצוני", items: ["בריכה"] }], source: "biz-shared-amenities" });

  const invalid = await businessAmenitiesResponse(new Request("https://vii.test/api/vii/business-amenities?id=0"), { token: async () => "secret", load: async () => [] });
  assert.equal(invalid.status, 400);
  const unavailable = await businessAmenitiesResponse(new Request("https://vii.test/api/vii/business-amenities?id=2483"), { token: async () => "", load: async () => [] });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");
});

test("vacation pages hydrate official groups without inventing a general group or merging room features", async () => {
  const source = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
  assert.match(source, /\/api\/vii\/business-amenities\?id=/);
  assert.match(source, /liveFeatureGroups \?\? \(property\.featureGroups\?\.length \? property\.featureGroups : \[\]\)/);
  assert.doesNotMatch(source, /title: "כללי"/);
  assert.doesNotMatch(source, /supplierDetail\.rooms\.flatMap\(\(room\) => room\.features\)/);
});

test("QQQAAA permanently checks official vacation amenity groups", async () => {
  const quality = await readFile(new URL("../app/lib/quality-platform.ts", import.meta.url), "utf8");
  assert.match(quality, /checkId: "api\.vacation\.amenity-groups"/);
  assert.match(quality, /\/api\/vii\/business-amenities\?id=2483/);
  assert.match(quality, /"מתחם חיצוני", "מתחם פנימי"/);
});
