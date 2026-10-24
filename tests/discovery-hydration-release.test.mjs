import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/lib/discovery-client-cache.ts", import.meta.url), "utf8");

test("discovery results wait only for an interactive document, not every image on the page", () => {
  assert.match(source, /document\.readyState !== "loading"/);
  assert.match(source, /document\.addEventListener\("DOMContentLoaded", afterLoad, \{ once: true \}\)/);
  assert.doesNotMatch(source, /window\.addEventListener\("load"/);
  assert.match(source, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => resolve\(\)\)\)/);
  assert.match(source, /return release\(load\(\)\)/);
  assert.match(source, /return release\(clone<T>\(previous\.value\)\)/);
});
