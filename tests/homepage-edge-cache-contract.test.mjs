import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("homepage HTML has a bounded edge cache while RSC and query responses bypass it", () => {
  assert.match(worker, /const homeCacheTtlMs = 60_000/);
  assert.match(worker, /if \(request\.method !== "GET" \|\| url\.search\) return false/);
  assert.match(worker, /if \(!\/\^\\\/\(\?:en\|ru\|fr\)\?\$\//);
  assert.match(worker, /request\.headers\.has\("Cookie"\).*request\.headers\.has\("Authorization"\)/);
  assert.match(worker, /request\.headers\.get\("RSC"\).*Next-Router-State-Tree/);
  assert.match(worker, /Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=30"/);
  assert.match(worker, /X-VII-Home-Cache-Until/);
  assert.match(worker, /caches\.default\.match\(cacheKey\)/);
  assert.match(worker, /caches\.default\.put\(cacheKey, cacheable\.clone\(\)\)/);
});
