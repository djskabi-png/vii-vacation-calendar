import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createSergeyPublicCatalogClient } from "../app/lib/sergey-public-catalog-client.ts";
import { createSergeyRoomsCatalogClient } from "../app/lib/sergey-rooms-catalog-client.ts";
import { createSpaPlusCatalogClient } from "../app/lib/spaplus-catalog-client.ts";

const clients = [
  ["vacations", createSergeyPublicCatalogClient, (client) => client.fetchCandidate("vacations"), "sergey_redirect_not_allowed"],
  ["events", createSergeyPublicCatalogClient, (client) => client.fetchCandidate("events"), "sergey_redirect_not_allowed"],
  ["rooms", createSergeyRoomsCatalogClient, (client) => client.fetchCandidate(), "sergey_redirect_not_allowed"],
  ["spa", createSpaPlusCatalogClient, (client) => client.fetchCandidate(), "spa_redirect_not_allowed"],
];

for (const [world, create, pull, code] of clients) {
  test(`${world} uses edge-supported manual redirects and never follows supplier redirects`, async () => {
    let calls = 0;
    const client = create({ apiKey: "unit-test-only-key", fetchImpl: async (_url, init) => {
      calls += 1;
      assert.equal(init.redirect, "manual");
      assert.equal(init.cache, "no-store");
      assert.ok(init.signal instanceof AbortSignal);
      return new Response(null, { status: 302, headers: { Location: "https://untrusted.invalid/" } });
    } });
    await assert.rejects(() => pull(client), (error) => error.message === code);
    assert.ok(calls > 0);
  });
}

test("workerd rejects error mode before transport but accepts manual mode without following", async () => {
  const require = createRequire(import.meta.url);
  const wranglerRequire = createRequire(require.resolve("wrangler/package.json"));
  const { Miniflare } = await import(pathToFileURL(wranglerRequire.resolve("miniflare")).href);
  const mf = new Miniflare({
    modules: true, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"],
    script: `export default {async fetch(request) {
      const mode = new URL(request.url).searchParams.get('mode');
      try {const response = await fetch('https://unit.invalid/catalog', {redirect: mode, cache: 'no-store', signal: AbortSignal.timeout(20000)});
        return Response.json({status: response.status});
      } catch(error) {return Response.json({name: error.name, message: error.message});}
    }};`,
    outboundService: () => new Response(null, { status: 302, headers: { Location: "https://untrusted.invalid/" } }),
  });
  try {
    const rejected = await (await mf.dispatchFetch("http://unit.local?mode=error")).json();
    assert.equal(rejected.name, "TypeError");
    assert.match(rejected.message, /Invalid redirect value/);
    const manual = await (await mf.dispatchFetch("http://unit.local?mode=manual")).json();
    assert.equal(manual.status, 302);
  } finally { await mf.dispose(); }
});
