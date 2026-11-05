import test from "node:test";
import assert from "node:assert/strict";
import { readGrowthEndpoint } from "../app/admin/growth/growth-read.ts";

test("growth read times out a response body and aborts it", async () => {
  let aborted = false;
  const controller = new AbortController();
  controller.signal.addEventListener("abort", () => { aborted = true; });
  const fetchImpl = async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) });
  const result = await readGrowthEndpoint(fetchImpl, "/api/admin/sitemap", "json", controller, 15);
  assert.equal(result.ok, false); assert.equal(result.error, "body_timeout"); assert.equal(aborted, true);
});

test("growth read returns a forbidden result without exposing a body", async () => {
  const controller = new AbortController();
  const result = await readGrowthEndpoint(async () => new Response("private", { status: 403 }), "/api/admin/overview", "json", controller, 50);
  assert.deepEqual(result, { ok: false, status: 403, value: null, error: "http_403" });
});

test("growth read completes a healthy endpoint independently", async () => {
  const controller = new AbortController();
  const result = await readGrowthEndpoint(async () => new Response("sitemap: /sitemap.xml", { status: 200 }), "/robots.txt", "text", controller, 50);
  assert.equal(result.ok, true); assert.equal(result.value, "sitemap: /sitemap.xml");
});

test("an older growth request is cancelled without completing stale data", async () => {
  const oldController = new AbortController();
  const old = readGrowthEndpoint(async (_url, options) => await new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }), "/api/admin/sitemap", "json", oldController, 100);
  oldController.abort();
  const result = await old;
  assert.equal(result.ok, false); assert.equal(result.error, "aborted");
});

test("superseding or unmounting aborts even a fetch adapter that never settles", async () => {
  const controller = new AbortController();
  const operation = readGrowthEndpoint(() => new Promise(() => {}), "/api/admin/overview", "json", controller, 1000);
  controller.abort();
  const result = await operation;
  assert.equal(result.ok,false); assert.equal(result.error,"aborted");
});
