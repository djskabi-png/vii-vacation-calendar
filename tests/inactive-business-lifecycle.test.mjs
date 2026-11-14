import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const source = (path) => readFile(new URL(path, root), "utf8");

test("all 405 legacy 410 candidates are evidence-classified", async () => {
  const inventory = await json("app/data/legacy-redirect-inventory.json");
  const report = await json("project_knowledge/diagnostics/vii-legacy-410-reconciliation-20261114.json");
  assert.equal(report.baselineGonePaths, 405);
  assert.equal(report.reclassifiedToRedirect + report.remainingGonePaths, 405);
  assert.equal(inventory.stats.inactiveBusinessRedirects, 402);
  assert.deepEqual(inventory.gone, ["/events/villa_douvdevan_tiberias", "/my_villa", "/seagal"]);
});

test("inactive archive preserves unique identities without public commerce or contact fields", async () => {
  const archive = await json("app/data/inactive-business-archive.generated.json");
  assert.equal(archive.records.length, 369);
  assert.equal(new Set(archive.records.map((item) => `${item.world}:${item.supplierId}`)).size, 369);
  const serialized = JSON.stringify(archive).toLowerCase();
  for (const forbidden of ["phone", "whatsapp", "booking", "availability", "price"]) assert.equal(serialized.includes(forbidden), false, forbidden);
  for (const row of archive.records) {
    assert.match(row.canonicalPath, /^\/(?:business\?id=vacation-|events\/place\/event-|discover\/place\/(?:hourly|spa)-)\d+$/);
    assert.ok(row.name.trim());
  }
});

test("inactive public page is indexable but has no contact or offer surface", async () => {
  const page = await source("app/components/inactive-business-page.tsx");
  assert.match(page, /robots: \{ index: true, follow: true \}/);
  assert.match(page, /ירד מפרסום/);
  assert.match(page, /פרטי הטלפון, הוואטסאפ, ההזמנה והזמינות הוסרו/);
  assert.match(page, /place\.images\.map/);
  assert.match(page, /הגלריה המלאה/);
  assert.doesNotMatch(page, /tel:|wa\.me|LocalBusiness|Offer/);
});

test("active accepted supplier rows override historical inactive archive records", async () => {
  const archive = await source("app/lib/inactive-business-archive.ts");
  assert.match(archive, /readSupplierCatalogEntry\(database, world, supplierId\)/);
  assert.match(archive, /if \(await readSupplierCatalogEntry\(database, world, supplierId\)\) return null/);
  for (const route of ["app/business/page.tsx", "app/events/place/[id]/page.tsx", "app/discover/place/[id]/page.tsx"]) {
    assert.match(await source(route), /publicCatalogSelectedSummaries/);
  }
});

test("all four public sitemap families include inactive canonical pages", async () => {
  const sitemap = await source("app/lib/sitemap-inventory.ts");
  for (const world of ["vacations", "events", "spa", "rooms"]) assert.match(sitemap, new RegExp(`inactiveEntries\\(\\\"${world}\\\"\\)`));
});

test("administration exposes inactive pages and supplier-verified reactivation", async () => {
  const api = await source("app/api/admin/catalog-sync/route.ts");
  const admin = await source("app/admin/catalog-sync/page.tsx");
  assert.match(api, /inactiveBusinesses/);
  assert.match(admin, /מקומות לא פעילים/);
  assert.match(admin, /בדיקה והחזרה אם פעיל/);
  assert.match(admin, /void pull\(item\.world\)/);
});

test("inactive gallery filenames are eligible for immutable legacy-origin recovery", async () => {
  const recovery = await source("app/lib/catalog-media-origin-recovery.ts");
  assert.match(recovery, /inactive-business-archive\.generated\.json/);
  assert.match(recovery, /if \(archivedStaticFiles\.has\(filename\)\) return true/);
  assert.match(recovery, /https:\/\/www\.vii\.co\.il\/gallery\//);
  const archive = await json("app/data/inactive-business-archive.generated.json");
  const filename = archive.records.flatMap((item) => item.images).find(Boolean).split("/").at(-1);
  const { catalogReferencesGallery } = await import("../app/lib/catalog-media-origin-recovery.ts");
  assert.equal(await catalogReferencesGallery({ prepare() { throw new Error("D1 must not be needed for a static archived filename"); } }, filename), true);
});
