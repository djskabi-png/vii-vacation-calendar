import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the public spa catalog contains every place and package returned by Spa Plus", async () => {
  const catalog = JSON.parse(await read("app/data/spaplus-catalog.json"));
  const sites = catalog.sites;
  const packages = sites.flatMap((site) => site.packages);
  assert.equal(sites.length, 159);
  assert.equal(packages.length, 1005);
  assert.equal(new Set(sites.map((site) => site.id)).size, sites.length);
  assert.ok(sites.every((site) => site.title && site.image && site.bookingUrl && site.about.length));
  assert.ok(packages.every((pack) => pack.title && pack.price > 0 && pack.bookingUrl));
  assert.ok(sites.every((site) => new URL(site.image).hostname === "www.spaplus.co.il"));
  assert.ok(packages.every((pack) => new URL(pack.bookingUrl).hostname === "www.spaplus.co.il"));
  assert.ok(!JSON.stringify(catalog).includes("Kew0Rd!"));
});

test("spa discovery and detail read only the supplier catalog", async () => {
  const [world, details, page, booking] = await Promise.all([
    read("app/data/world-data.ts"),
    read("app/data/spa-details.ts"),
    read("app/discover/place/client-page.tsx"),
    read("app/booking/page.tsx"),
  ]);
  assert.match(world, /spaPlaces: DiscoveryItem\[\] = spaPlusSites\.map/);
  assert.doesNotMatch(world, /curatedSpaPlaces|verifiedDiscoveryItems\("spa"\)/);
  assert.match(details, /spaPlusSiteById\(id\)/);
  assert.match(page, /href=\{pack\.bookingUrl\} target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(page, /spa-booking-dialog|<iframe/);
  assert.match(details, /url\.searchParams\.delete\("isFrame"\)/);
  assert.match(details, /url\.searchParams\.delete\("ispackFrame"\)/);
  assert.doesNotMatch(page, /booking\?world=spa&place=/);
  assert.match(booking, /redirect\(pack\?\.bookingUrl \|\| details\.bookingUrl\)/);
  const oldCatalog = JSON.parse(await read("app/data/verified-catalog.json"));
  assert.equal(Object.hasOwn(oldCatalog, "spa"), false);
  assert.doesNotMatch(await read("scripts/build-verified-catalog.mjs"), /spaPages|parseSpaCards|catalog\.spa/);
});

test("old spa URLs redirect only to present supplier records without retaining old listings", async () => {
  const aliases = JSON.parse(await read("app/data/spaplus-legacy-aliases.json"));
  const catalog = JSON.parse(await read("app/data/spaplus-catalog.json"));
  assert.equal(Object.keys(aliases).length, 42);
  assert.ok(Object.values(aliases).every((id) => catalog.sites.some((site) => `spa-${site.id}` === id)));
  assert.equal(aliases["assemblage-spa"], "spa-365");
});
