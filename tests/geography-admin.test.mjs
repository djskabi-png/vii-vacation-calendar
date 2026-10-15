import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fetchSupplierGeography, normalizeSupplierGeography, parseGeographyChange } from "../app/lib/geography-admin.ts";

test("supplier geography scopes overlapping ids by hierarchy level and preserves unassigned city coordinates", () => {
  const nodes = normalizeSupplierGeography({
    districts: [{ id: 2, title: "הצפון", title_en: "North", areas: [{ id: 9, title: "גליל", cities: [{ id: 2, title: "צפת", gps_lat: 32.9646, gps_long: 35.3815 }] }] }],
    unassigned: { cities: [{ id: 118, area_id: 0, title: "בית ליד", title_en: "Bayt Lid", gps_lat: 32.261548, gps_long: 35.13028 }] },
  });
  assert.ok(nodes.some((node) => node.key === "district:2"));
  assert.ok(nodes.some((node) => node.key === "city:2" && node.parentKey === "area:9"));
  assert.deepEqual(nodes.find((node) => node.key === "city:118"), {
    key: "city:118", level: "city", supplierId: 118, parentKey: "area:0", title: "בית ליד", titleEn: "Bayt Lid",
    gpsLat: 32.261548, gpsLong: 35.13028, unassigned: true,
  });
});

test("supplier geography accepts data wrappers and object-keyed collections", () => {
  const nodes = normalizeSupplierGeography({ data: { districts: { north: { id: 1, title: "צפון", areas: { galil: { id: 2, title: "גליל", cities: { nahariya: { id: 3, title: "נהריה" } } } } } } } });
  assert.deepEqual(nodes.map((node) => node.key), ["district:1", "area:2", "city:3"]);
});

test("supplier geography uses the edge-supported manual redirect mode", async () => {
  let init;
  const nodes = await fetchSupplierGeography("private-token", async (_url, options) => {
    init = options;
    return Response.json({ cities: [{ id: 118, title: "בית ליד" }] });
  });
  assert.equal(init.redirect, "manual");
  assert.equal(init.headers.Authorization, "Bearer private-token");
  assert.equal(nodes[0].key, "city:118");
});

test("supplier geography rejects redirects without following them", async () => {
  await assert.rejects(() => fetchSupplierGeography("private-token", async () =>
    new Response(null, { status: 302, headers: { Location: "https://example.invalid/" } })),
  /supplier_geography_redirect_not_allowed/);
});

test("manual geography change accepts scoped keys and rejects unsafe slugs or coordinates", () => {
  const base = { key: "city:118", titleOverride: "", titleEnOverride: "Bayt Lid", slug: "bayt-lid", visible: true, featured: false, gpsLat: 32.261548, gpsLong: 35.13028, expectedVersion: 1 };
  assert.ok(parseGeographyChange(base));
  assert.equal(parseGeographyChange({ ...base, slug: "בית ליד" }), null);
  assert.equal(parseGeographyChange({ ...base, gpsLat: 90 }), null);
});

test("admin and public search are wired to the managed geography source", async () => {
  const [nav, command, box, page] = await Promise.all([
    readFile(new URL("../app/admin/admin-nav.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/admin-command-bar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/geography/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(nav, /\/admin\/geography/);
  assert.match(command, /ערים ואזורים/);
  assert.match(box, /fetch\("\/api\/vii\/geography"/);
  assert.match(page, /רענון מה־API/);
  assert.match(page, /מזהי ספק נשמרים לפי רמה/);
});
