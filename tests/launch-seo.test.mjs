import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { legacyPlaceDestination } from "../app/lib/legacy-route-map.ts";

test("known legacy place paths map directly to equivalent new detail pages", () => {
  assert.equal(legacyPlaceDestination("/Azulat_Anof"), "/business?id=vacation-1");
  assert.equal(legacyPlaceDestination("/events/Enrico_Events"), "/events/place/event-2684");
  assert.equal(legacyPlaceDestination("/rooms/ascape_room"), "/discover/place/hourly-1915");
  assert.equal(legacyPlaceDestination("/unverified-place"), null);
});

test("Cloudflare HTMLRewriter path applies staging noindex to HTML responses", async () => {
  const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(workerSource, /if \(!primary\) return storeCachedHome\(await withLaunchSeo\(transformed, url, false\), cacheKey, ctx\)/);
  assert.match(workerSource, /type\.includes\("text\/html"\)/);
});

test("temporary host stays out of the index and primary host gets its own canonicals", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const render = (url) => worker.fetch(new Request(url, { headers: { accept: "text/html" } }), env, ctx);

  const staging = await render("https://vii.spaplus.co/");
  assert.equal(staging.status, 200);
  assert.equal(staging.headers.get("x-robots-tag"), "noindex");

  const primary = await render("https://www.vii.co.il/");
  assert.equal(primary.status, 200);
  assert.equal(primary.headers.get("x-robots-tag"), null);
  const html = await primary.text();
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.vii\.co\.il\/"/);
  assert.doesNotMatch(html, /https:\/\/vii\.spaplus\.co/);

  const redirect = await render("https://www.vii.co.il/Azulat_Anof");
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), "https://www.vii.co.il/business?id=vacation-1");
  const unknown = await render("https://www.vii.co.il/unverified-place");
  assert.equal(unknown.status, 404);

  const primaryRobots = await render("https://www.vii.co.il/robots.txt");
  assert.equal(primaryRobots.status, 200);
  assert.match(await primaryRobots.text(), /https:\/\/www\.vii\.co\.il\/sitemap\.xml/);
  const primarySitemap = await render("https://www.vii.co.il/sitemap.xml");
  assert.equal(primarySitemap.status, 200);
  const xml = await primarySitemap.text();
  assert.match(xml, /https:\/\/www\.vii\.co\.il\/business\?id=vacation-1/);
  assert.doesNotMatch(xml, /https:\/\/vii\.spaplus\.co/);
});
