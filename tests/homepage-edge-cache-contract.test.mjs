import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const cache = await readFile(new URL("../worker/public-response-cache.ts", import.meta.url), "utf8");
const config = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

test("public HTML and catalog reads have bounded host-aware caches with private exclusions", () => {
  assert.match(cache, /const publicCacheVersion = "v4"/);
  assert.match(cache, /admin\|account\|favorites\|booking/);
  assert.match(cache, /hasPrivateCookies/);
  assert.match(cache, /X-VII-Navigation-Cache/);
  assert.match(cache, /runtime-cache\/public\/\$\{publicCacheVersion\}\/\$\{build\}/);
  assert.match(worker, /await publicCachePolicy\(request, url, publicCacheBuild\)/);
  assert.match(worker, /cachePolicy\?\.kind !== "document"/);
  assert.match(config, /__VII_CACHE_BUILD_ID__.*JSON.stringify\(publicCacheBuildId\)/);
});
