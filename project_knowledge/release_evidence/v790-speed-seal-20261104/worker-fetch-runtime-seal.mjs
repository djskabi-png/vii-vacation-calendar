import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import worker from "../../../dist/server/index.js";

const pending = [];
const ctx = { waitUntil(promise) { pending.push(Promise.resolve(promise)); }, passThroughOnException() {} };
const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const request = (path, headers = {}) => new Request(`https://vii.spaplus.co${path}`, { headers: { Accept: "text/html", ...headers } });

const firstStart = performance.now();
const first = await worker.fetch(request("/spas"), env, ctx);
const firstBytes = await first.arrayBuffer();
const firstMs = performance.now() - firstStart;
assert.equal(first.status, 200, "cold document must render");
assert.equal(first.headers.get("X-VII-Page-Cache"), "MISS", "first anonymous document must be a cache miss");

const secondStart = performance.now();
const second = await worker.fetch(request("/spas"), env, ctx);
const secondBytes = await second.arrayBuffer();
const secondMs = performance.now() - secondStart;
assert.equal(second.status, 200, "warm document must render");
assert.equal(second.headers.get("X-VII-Page-Cache"), "HIT", "second anonymous document must be a cache hit");
assert.equal(Buffer.compare(Buffer.from(firstBytes), Buffer.from(secondBytes)), 0, "cache hit body must be identical");

const privateResponse = await worker.fetch(request("/spas", { Cookie: "vii_customer_session=seal-probe" }), env, ctx);
await privateResponse.arrayBuffer();
assert.equal(privateResponse.headers.get("X-VII-Page-Cache"), null, "private cookie must bypass public page cache");
assert.equal(privateResponse.headers.get("X-VII-Cache-Layer"), null, "private cookie must bypass cache layers");

const localeResponse = await worker.fetch(request("/en/spas"), env, ctx);
await localeResponse.arrayBuffer();
assert.equal(localeResponse.status, 200, "locale document must render");
assert.equal(localeResponse.headers.get("X-VII-Page-Cache"), "MISS", "locale must have an independent cache identity");

const navigationResponse = await worker.fetch(new Request("https://vii.spaplus.co/spas.rsc?_rsc", { headers: { Accept: "text/x-component", RSC: "1", "X-Vinext-Rsc-Render-Mode": "navigation" } }), env, ctx);
await navigationResponse.arrayBuffer();
assert.equal(navigationResponse.status, 200, "navigation payload must render");
assert.equal(navigationResponse.headers.get("X-VII-Navigation-Cache"), "MISS", "navigation must use its own cache kind");

await Promise.all(pending);
console.log(JSON.stringify({ verdict: "passed", firstMs: Number(firstMs.toFixed(1)), secondMs: Number(secondMs.toFixed(1)), cache: { document: "HIT", private: "bypass", locale: "separate", navigation: "separate" }, appLoader: "not instrumented by candidate" }, null, 2));
