import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const client = readFileSync(new URL("../app/components/spa-package-deals.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/spa/deals/route.ts", import.meta.url), "utf8");
const warmer = readFileSync(new URL("../app/lib/warm-spa-discovery-cache.ts", import.meta.url), "utf8");
const cacheKey = readFileSync(new URL("../app/lib/spa-discovery-cache-key.ts", import.meta.url), "utf8");

test("SPA rail shares one verified cache identity and keeps presentation fairness client-side", () => {
  assert.doesNotMatch(client, /rotation:String\(/, "document rotation must not fragment transport cache identity");
  assert.doesNotMatch(client, /URLSearchParams\([^\n]*rotation:/, "SPA request URL must remain canonical");
  assert.match(client, /orderDiscoveryRail\)[\s\S]*seed: `\$\{documentSeed\}:spa:/, "client-side ordering still varies fairly by document");
  assert.match(client, /persist:true, freshMs:120_000, staleMs:900_000/, "last verified rail data remains available during refresh");
});

test("SPA rail waits through the observed supplier response while full pages keep their larger budget", () => {
  assert.match(route, /full \? 8_000 : 4_500/);
});

test("SPA rail and scheduled warmer share one rolling snapshot across date rollover", () => {
  assert.match(cacheKey, /spa-discovery-availability/);
  assert.match(cacheKey, /rolling/);
  assert.match(route, /key: spaDiscoveryAvailabilityCacheKey/);
  assert.match(warmer, /key: spaDiscoveryAvailabilityCacheKey/);
});
