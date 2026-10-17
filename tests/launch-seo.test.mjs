import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { legacyDisposition, legacyInventoryStats, legacyPlaceDestination, looksLikeUninventoriedLegacyPath } from "../app/lib/legacy-route-map.ts";

test("known legacy place paths map directly to equivalent new detail pages", () => {
  assert.equal(legacyPlaceDestination("/Azulat_Anof"), "/business?id=vacation-1");
  assert.equal(legacyPlaceDestination("/events/Enrico_Events"), "/events/place/event-2684");
  assert.equal(legacyPlaceDestination("/rooms/ascape_room"), "/discover/place/hourly-1915");
  assert.equal(legacyPlaceDestination("/unverified-place"), null);
  assert.deepEqual(legacyDisposition("/אהבה_בשניים"), { status: 410 });
  assert.equal(legacyInventoryStats.total, legacyInventoryStats.redirects + legacyInventoryStats.gone);
  assert.ok(legacyInventoryStats.total >= 3500);
  assert.equal(looksLikeUninventoriedLegacyPath("/s/Netanya/12806"), true);
  assert.equal(looksLikeUninventoriedLegacyPath("/assets/app.js"), false);
});

test("Cloudflare HTMLRewriter path applies staging noindex to HTML responses", async () => {
  const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(workerSource, /if \(!primary\) \{\s*const output = await withLaunchSeo\(transformed, url, false\);[\s\S]*?return storePublicCache\(output, cachePolicy, env, ctx\)/);
  assert.match(workerSource, /const canonical = rewriteCanonicalStream\(response, makeLocaleLinks\)/);
  assert.match(workerSource, /const output = primary \? rewriteOriginStream\(canonical, temporaryOrigin, primaryOrigin\) : canonical/);
  assert.match(workerSource, /withLaunchSeo\(output, url, primary\)/);
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

  for (const path of ["/admin", "/admin/search-pages", "/admin/catalog-sync", "/admin/redirects"]) {
    const admin = await render(`https://vii.spaplus.co${path}`);
    assert.ok([302, 303, 307, 308].includes(admin.status), `${path} returned ${admin.status}`);
    assert.match(admin.headers.get("location") || "", /^https:\/\/vii\.spaplus\.co\/api\/auth\/google\?returnTo=/);
    const body = await admin.text();
    assert.doesNotMatch(body, /מרכזי העבודה|מרכז קידום|קטלוגים וספקים/);
  }

  const primary = await render("https://www.vii.co.il/");
  assert.equal(primary.status, 200);
  assert.equal(primary.headers.get("x-robots-tag"), null);
  const html = await primary.text();
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.vii\.co\.il\/"/);
  assert.doesNotMatch(html, /https:\/\/vii\.spaplus\.co/);

  const redirect = await render("https://www.vii.co.il/Azulat_Anof");
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), "https://www.vii.co.il/business?id=vacation-1");
  const unknown = await render("https://www.vii.co.il/unverified-place");
  assert.equal(unknown.status, 410);
  assert.equal((await render("https://www.vii.co.il/%D7%90%D7%94%D7%91%D7%94_%D7%91%D7%A9%D7%A0%D7%99%D7%99%D7%9D")).status, 410);
  const searchRedirect = await render("https://www.vii.co.il/s/Netanya/12806");
  assert.equal(searchRedirect.status, 301);
  const searchLocation = searchRedirect.headers.get("location") || "";
  assert.match(searchLocation, /^https:\/\/www\.vii\.co\.il\/search\/vacations\/[a-z0-9-]+$/);
  const searchTarget = await render(searchLocation);
  assert.equal(searchTarget.status, 200);
  const apex = await render("https://vii.co.il/Azulat_Anof");
  assert.equal(apex.status, 301);
  assert.equal(apex.headers.get("location"), "https://www.vii.co.il/business?id=vacation-1");

  const primaryRobots = await render("https://www.vii.co.il/robots.txt");
  assert.equal(primaryRobots.status, 200);
  assert.match(await primaryRobots.text(), /https:\/\/www\.vii\.co\.il\/sitemap\.xml/);
  const primarySitemap = await render("https://www.vii.co.il/sitemap.xml");
  assert.equal(primarySitemap.status, 200);
  const xml = await primarySitemap.text();
  assert.match(xml, /https:\/\/www\.vii\.co\.il\/sitemaps\/vacations\/1\.xml/);
  assert.doesNotMatch(xml, /https:\/\/vii\.spaplus\.co/);
  const vacationSitemap = await render("https://www.vii.co.il/sitemaps/vacations/1.xml");
  assert.equal(vacationSitemap.status, 200);
  assert.match(await vacationSitemap.text(), /https:\/\/www\.vii\.co\.il\/business\?id=vacation-1/);
});

test("active administration records override the generated inventory on public requests", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const rows = new Map([
    ["/azulat_anof", { source_path: "/azulat_anof", target_path: "/search", status: 301, active: 1 }],
    ["/retired-manual", { source_path: "/retired-manual", target_path: null, status: 410, active: 1 }],
  ]);
  const DB = { prepare: () => ({ bind: (source) => ({ first: async () => rows.get(source.toLowerCase()) || null }) }) };
  const env = { DB, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const managed = await worker.fetch(new Request("https://www.vii.co.il/Azulat_Anof", { headers: { accept: "text/html" } }), env, ctx);
  assert.equal(managed.status, 301);
  assert.equal(managed.headers.get("location"), "https://www.vii.co.il/search");
  const gone = await worker.fetch(new Request("https://www.vii.co.il/retired-manual", { headers: { accept: "text/html" } }), env, ctx);
  assert.equal(gone.status, 410);
  assert.equal(gone.headers.get("x-robots-tag"), "noindex, follow");
});
