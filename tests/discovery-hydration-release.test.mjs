import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/lib/discovery-client-cache.ts", import.meta.url), "utf8");

test("discovery results wait for the streamed document to finish hydrating", () => {
  assert.match(source, /window\.addEventListener\("load", afterLoad, \{ once: true \}\)/);
  assert.match(source, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => resolve\(\)\)\)/);
  assert.match(source, /return release\(load\(\)\)/);
  assert.match(source, /return release\(clone<T>\(previous\.value\)\)/);
});
