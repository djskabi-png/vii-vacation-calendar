import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildSergeyAmenityIndex, sergeyAmenityGroups } from "../app/lib/sergey-amenities.ts";
import { fetchLiveBusinessAmenities, legacyViiAmenityGroups } from "../app/lib/live-business-amenities.ts";
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
  assert.deepEqual(await fetchLiveBusinessAmenities({ supplierId: 2483, token: "secret", fetchImpl }), {
    groups: [{ title: "מתחם חיצוני", items: ["בריכה"] }],
    source: "biz-shared-amenities",
  });
});

test("live business amenities fall back to the official list taxonomy when detail groups are empty", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const path = new URL(url).pathname;
    if (path.endsWith("/vacations/2483")) return Response.json({ id: 2483, active: true, shared_amenities: [] });
    if (path.endsWith("/vacations/types")) return Response.json({
      amenity_categories: [
        { categoryID: 1, categoryName: "מתחם חיצוני" },
        { categoryID: 2, categoryName: "מתחם פנימי" },
      ],
      amenities: [
        { id: 11, categoryID: 1, title: "בריכה", orderInCategory: 1 },
        { id: 12, categoryID: 2, title: "מטבח מאובזר", orderInCategory: 1 },
      ],
    });
    if (path.endsWith("/vacations")) return Response.json({
      places: [
        { siteID: 12, shared_amenities: [999] },
        { siteID: 2483, shared_amenities: [12, 11] },
      ],
    });
    return new Response("missing", { status: 404 });
  };
  assert.deepEqual(await fetchLiveBusinessAmenities({ supplierId: 2483, token: "secret", fetchImpl }), {
    groups: [
      { title: "מתחם חיצוני", items: ["בריכה"] },
      { title: "מתחם פנימי", items: ["מטבח מאובזר"] },
    ],
    source: "biz-shared-amenities",
  });
  assert.equal(calls.filter((url) => new URL(url).pathname.endsWith("/vacations")).length, 1);
});

test("legacy VII place amenities preserve the exact topic grouping when Biz shared amenities are empty", async () => {
  const html = `<section class="minisite-properties"><div class="inner"><div class="desk">
    <div class="item"><div class="title"><span>מידע</span></div><ul><li>15 אורחים</li></ul></div>
    <div class="item"><div class="title"><span>מתחם חיצוני</span></div><ul><li>בריכת שחייה מגודרת</li><li>פינות שיזוף</li></ul></div>
    <div class="item"><div class="title"><span>מתחם פנימי</span></div><ul><li>מטבח מאובזר</li><li>נטפליקס</li></ul></div>
  </div></div></section>`;
  assert.deepEqual(legacyViiAmenityGroups(html), [
    { title: "מתחם חיצוני", items: ["בריכת שחייה מגודרת", "פינות שיזוף"] },
    { title: "מתחם פנימי", items: ["מטבח מאובזר", "נטפליקס"] },
  ]);
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/vacations/2483")) return Response.json({
      id: 2483, active: true, page_url: "https://www.vii.co.il/megic_mia", shared_amenities: [],
    });
    if (path.endsWith("/vacations/types")) return Response.json({ amenity_categories: [], amenities: [] });
    if (path.endsWith("/vacations")) return Response.json({ places: [{ siteID: 2483 }] });
    if (url === "https://www.vii.co.il/megic_mia") return new Response(html, { headers: { "Content-Type": "text/html" } });
    return new Response("missing", { status: 404 });
  };
  assert.deepEqual(await fetchLiveBusinessAmenities({ supplierId: 2483, token: "secret", fetchImpl }), {
    groups: [
      { title: "מתחם חיצוני", items: ["בריכת שחייה מגודרת", "פינות שיזוף"] },
      { title: "מתחם פנימי", items: ["מטבח מאובזר", "נטפליקס"] },
    ],
    source: "legacy-vii-place-amenities",
  });
});

test("public endpoint validates input, returns a cacheable source contract and fails honestly", async () => {
  const ok = await businessAmenitiesResponse(new Request("https://vii.test/api/vii/business-amenities?id=2483&v=3"), {
    token: async () => "secret",
    load: async () => ({ groups: [{ title: "מתחם חיצוני", items: ["בריכה"] }], source: "biz-shared-amenities" }),
  });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("cache-control"), /s-maxage=21600/);
  assert.deepEqual(await ok.json(), { supplierId: 2483, groups: [{ title: "מתחם חיצוני", items: ["בריכה"] }], source: "biz-shared-amenities" });

  const invalid = await businessAmenitiesResponse(new Request("https://vii.test/api/vii/business-amenities?id=0"), { token: async () => "secret", load: async () => ({ groups: [], source: "biz-shared-amenities" }) });
  assert.equal(invalid.status, 400);
  const invalidVersion = await businessAmenitiesResponse(new Request("https://vii.test/api/vii/business-amenities?id=2483&v=2"), { token: async () => "secret", load: async () => ({ groups: [], source: "biz-shared-amenities" }) });
  assert.equal(invalidVersion.status, 400);
  const unavailable = await businessAmenitiesResponse(new Request("https://vii.test/api/vii/business-amenities?id=2483"), { token: async () => "", load: async () => ({ groups: [], source: "biz-shared-amenities" }) });
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
