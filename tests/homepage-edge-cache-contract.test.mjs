import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("public HTML and catalog reads have bounded host-aware caches with private exclusions", () => {
  assert.match(worker, /const publicCacheVersion = "v2"/);
  assert.match(worker, /publicDocumentTtl/);
  assert.match(worker, /url\.hostname/);
  assert.match(worker, /admin\|account\|favorites\|booking/);
  assert.match(worker, /request\.headers\.has\("Cookie"\).*request\.headers\.has\("Authorization"\)/);
  assert.match(worker, /request\.headers\.get\("RSC"\).*Next-Router-State-Tree/);
  assert.match(worker, /url\.pathname === "\/api\/catalog"/);
  assert.match(worker, /X-VII-Page-Cache/);
  assert.match(worker, /X-VII-Data-Cache/);
  assert.match(worker, /X-VII-Home-Cache-Until/);
  assert.match(worker, /runtime-cache\/public\/\$\{publicCacheVersion\}/);
  assert.match(worker, /env\.UPLOADS\.get\(policy\.key\)/);
  assert.match(worker, /cacheable\.clone\(\)\.arrayBuffer\(\)\.then\(\(body\) => env\.UPLOADS\.put\(policy\.key, body/);
  assert.match(worker, /customMetadata: \{ expiresAt \}/);
  assert.match(worker, /if \(!allowed\.has\(key\) \|\| seen\.has\(key\)\) return null/);
});
