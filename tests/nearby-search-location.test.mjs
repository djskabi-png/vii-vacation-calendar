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
});

test("nearby control has a server fallback and bounded browser request", () => {
  assert.match(search, /fetch\("\/api\/vii\/nearby-location"/);
  assert.match(search, /AbortSignal\.timeout\(1800\)/);
  assert.match(search, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(search, /timeout:\s*2000/);
  assert.match(search, /window\.setTimeout\(\(\) => \{ void approximate\(\); \}, 2200\)/);
  assert.match(search, /nearestSearchLocation\(coords\.latitude, coords\.longitude\)/);
  assert.match(route, /cloudflareRequestCoordinates/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /status: 503/);
});
