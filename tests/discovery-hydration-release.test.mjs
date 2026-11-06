import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/lib/discovery-client-cache.ts", import.meta.url), "utf8");

test("discovery results wait only for an interactive document, not every image on the page", () => {
  assert.match(source, /document\.readyState !== "loading"/);
  assert.match(source, /document\.addEventListener\("DOMContentLoaded", afterLoad, \{ once: true \}\)/);
  assert.doesNotMatch(source, /window\.addEventListener\("load"/);
  assert.match(source, /requestAnimationFrame\(\(\) => requestAnimationFrame\(/);
  assert.match(source, /return release\(load\(\)\)/);
  assert.match(source, /return release\(clone<T>\(previous\.value\)\)/);
});


test("discovery release has a bounded fallback when a background tab pauses animation frames", async () => {
  const { default: ts } = await import("typescript");
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const fakeFetch = async () => Response.json({ deals: [123] });
  new Function("exports", "window", "document", "requestAnimationFrame", "fetch", javascript)(exports, {}, {readyState:"interactive"}, ()=>0, fakeFetch);
  const result = await Promise.race([exports.discoveryJson("/api/hidden-tab-fixture","one",{retries:0}), new Promise((_,reject)=>setTimeout(()=>reject(Error("release remained stuck")),500))]);
  assert.deepEqual(result,{deals:[123]});
});
