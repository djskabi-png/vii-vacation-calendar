import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("map health contract covers every monitored world with real interactive-map evidence", async () => {
  const [route, registry, map] = await Promise.all([
    fs.readFile(new URL("../app/api/map-health/route.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/lib/quality-platform.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /coordinatesReady/);
  assert.match(route, /interactiveMap:\s*true/);
  assert.match(route, /tileSource:\s*"openstreetmap"/);
  for (const target of ["vacation-116", "event-2", "hourly-475", "spa-6"]) assert.match(registry, new RegExp(target));
  assert.match(registry, /\/api\/map-health/);
  assert.match(map, /useState\(autoLoad \|\| single\)/);
  assert.match(map, /tile\.openstreetmap\.org/);
});
