import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const moduleSource = readFileSync(new URL("../app/lib/nearby-search-location.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(moduleSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const search = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/vii/nearby-location/route.ts", import.meta.url), "utf8");

test("maps representative Israeli coordinates to the nearest supported search region", () => {
  assert.equal(loaded.nearestSearchLocation(32.0853, 34.7818), "מרכז");
  assert.equal(loaded.nearestSearchLocation(31.7683, 35.2137), "ירושלים והרי יהודה");
  assert.equal(loaded.nearestSearchLocation(29.5577, 34.9519), "אילת והערבה");
  assert.equal(loaded.nearestSearchLocation(Number.NaN, 34.8), null);
  assert.equal(loaded.nearestSearchLocation(40.7128, -74.006), null);
});

test("prefers the nearest approved managed city without exposing coordinates", () => {
  const cities = [
    { key: "city:tel-aviv", level: "city", parentKey: "area:center", title: "תל אביב", titleEn: "Tel Aviv", slug: "tel-aviv", featured: true, gpsLat: 32.0853, gpsLong: 34.7818, unassigned: false },
    { key: "city:haifa", level: "city", parentKey: "area:north", title: "חיפה", titleEn: "Haifa", slug: "haifa", featured: true, gpsLat: 32.794, gpsLong: 34.9896, unassigned: false },
  ];
  assert.equal(loaded.nearestSearchLocation(32.081, 34.79, cities), "תל אביב");
  assert.deepEqual(loaded.nearestSearchResolution(32.081, 34.79, cities).precision, "city");
});

test("nearby control has a server fallback and bounded browser request", () => {
  assert.match(search, /fetch\("\/api\/vii\/nearby-location"/);
  assert.match(search, /AbortSignal\.timeout\(3500\)/);
  assert.match(search, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(search, /timeout:\s*8000/);
  assert.match(search, /window\.setTimeout\(\(\) => \{ void approximate\(\); \}, 8500\)/);
  assert.match(search, /loadManagedGeography\(\)/);
  assert.match(search, /nearestSearchLocation\(coords\.latitude, coords\.longitude, nodes\)/);
  assert.match(route, /cloudflareRequestCoordinates/);
  assert.match(route, /readGeography/);
  assert.match(route, /nearestSearchResolution/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /status: 503/);
});
