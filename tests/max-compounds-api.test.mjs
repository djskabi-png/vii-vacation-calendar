import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaxCompoundsClient, MaxCompoundsApiError } from "../app/lib/max-compounds-api.ts";

test("read requests stay authenticated, uncached and on Max's documented host", async () => {
  const calls = [];
  const client = createMaxCompoundsClient({
    apiKey: "test-secret",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ ok: true, data: { siteID: 12 } });
    },
  });
  assert.deepEqual(await client.site(12), { siteID: 12 });
  assert.equal(calls[0].url, "https://bizonline.co.il/api/partner/v1/compounds/sites/12?lang=he");
  assert.equal(calls[0].init.headers["X-API-Key"], "test-secret");
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.redirect, "error");
});

test("search and quote use the documented POST envelope", async () => {
  const calls = [];
  const client = createMaxCompoundsClient({
    apiKey: "test-secret",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ ok: true, data: { results: [] } });
    },
  });
  await client.search({ siteID: 12 });
  await client.quote({ siteID: 12 });
  assert.deepEqual(calls.map(({ url }) => url.split("/").at(-1)), ["search", "quote"]);
  assert.ok(calls.every(({ init }) => init.method === "POST" && init.body === '{"siteID":12}'));
});

test("missing key, invalid dates and provider permission failure remain explicit", async () => {
  assert.throws(() => createMaxCompoundsClient({ apiKey: " " }), { code: "missing_api_key" });
  const client = createMaxCompoundsClient({
    apiKey: "test-secret",
    fetchImpl: async () => Response.json({ ok: false, error: { code: "not_allowed", message: "no access" } }, { status: 403 }),
  });
  await assert.rejects(client.site(12), { code: "not_allowed", status: 403 });
  assert.throws(() => client.vacancy(12, "2026-10-15", "2026-10-14"), { code: "invalid_date_range" });
  assert.throws(() => client.site(0), { code: "invalid_id" });
});

test("malformed and transport responses never disclose the key", async () => {
  const malformed = createMaxCompoundsClient({ apiKey: "test-secret", fetchImpl: async () => new Response("bad", { status: 502 }) });
  await assert.rejects(malformed.site(1), (error) => error instanceof MaxCompoundsApiError && error.code === "invalid_response" && !error.message.includes("test-secret"));
  const network = createMaxCompoundsClient({ apiKey: "test-secret", fetchImpl: async () => { throw new Error("test-secret"); } });
  await assert.rejects(network.site(1), { code: "transport_error" });
});
