import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("all public failure surfaces are branded, non-cacheable and loop bounded", async () => {
  const [edge, route, globalBoundary, surface, config] = await Promise.all([
    read("services/vii-edge-delivery/src/index.ts"),
    read("app/error.tsx"),
    read("app/global-error.tsx"),
    read("app/components/error-recovery-surface.tsx"),
    read("services/vii-edge-delivery/wrangler.toml"),
  ]);
  assert.match(edge, /temporaryFailureResponse/);
  assert.match(edge, /private, no-store, must-revalidate/);
  assert.match(edge, /X-VII-Edge-Recovery/);
  assert.match(edge, /Retry-After/);
  assert.match(edge, /status: 503/);
  assert.match(edge, /console\.error\("VII edge request contained"/);
  for (const boundary of [route, globalBoundary]) {
    assert.match(boundary, /recoverRouteBoundaryOnce/);
    assert.match(boundary, /recoverStalledNavigation/);
    assert.match(boundary, /window\.location\.reload\(\)/);
  }
  assert.match(surface, /role=\{recovering \? "status" : "alert"\}/);
  assert.match(surface, /rubik-hebrew-v31\.woff2/);
  assert.match(config, /\[observability\][\s\S]*enabled = true[\s\S]*head_sampling_rate = 1/);
});

test("a missing optional map snapshot is an expected empty response, not a console 404", async () => {
  const route = await read("app/api/map-snapshot/route.ts");
  assert.match(route, /X-VII-Map-Snapshot/);
  assert.equal((route.match(/status: 404/g) || []).length, 1, "only malformed map snapshot requests may be 404");
  assert.ok((route.match(/status: 204/g) || []).length >= 4);
});
