import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("unit, sleeping, taxonomy and identical inventory remain separate and verified", async () => {
  const [page, sleeping, calendar, detail] = await Promise.all([
    read("app/business/client-page.tsx"),
    read("app/components/verified-sleeping-details.tsx"),
    read("app/calendar-demo.tsx"),
    read("app/data/supplier-place-detail.ts"),
  ]);
  assert.match(page, /property\.roomOptions\.map/);
  assert.match(page, /<VerifiedSleepingDetails/);
  assert.match(page, /roomType:/);
  assert.match(detail, /sergeyRoomType\(room\.roomType/);
  assert.match(page, /featureGroups/);
  assert.doesNotMatch(page, /features\.filter\(\(item\) => \/בריכ/);
  assert.match(page, /roomSleepingGroups/);
  assert.match(page, /איפה תשנו ביחידה/);
  assert.match(page, /availableIdenticalUnits/);
  assert.match(page, /\{availableIdenticalUnits\} מתוך \{room\.quantity\}/);
  assert.match(sleeping, /יחידות זהות פנויות/);
  assert.match(calendar, /יחידות פנויות בטווח שנבחר/);
});

test("the staged fallback preserves the supplier taxonomy used by live refreshes", async () => {
  const [stage, build, amenities] = await Promise.all([
    read("scripts/stage-sergey-vii-catalog.mjs"),
    read("scripts/build-sergey-public-catalog.mjs"),
    read("app/lib/sergey-amenities.ts"),
  ]);
  assert.match(stage, /get\(`\/\$\{world\}\/types`\)/);
  assert.match(stage, /types: worldTypes/);
  assert.match(build, /buildSergeyAmenityIndex\(source\.types\?\.\[world\]/);
  assert.match(build, /roomType: sergeyRoomType\(room\.roomType/);
  assert.match(build, /featureGroups: sergeyAmenityGroups\(raw\.shared_amenities/);
  assert.match(build, /\.\.\.sergeyAmenityGroups\(room\.amenities/);
  assert.match(amenities, /return \[\.\.\.groups\]\.map/);
});

test("supplier gallery names and membership remain authoritative and shareable", async () => {
  const [gallery, selection, hook, page, bundledDetails] = await Promise.all([
    read("app/components/gallery-experience.tsx"),
    read("app/components/gallery-selection.ts"),
    read("app/components/use-gallery-deep-link.ts"),
    read("app/business/client-page.tsx"),
    read("app/data/sergey-place-details.json").then(JSON.parse),
  ]);
  assert.match(gallery, /property\.galleryGroups\?\.length/);
  assert.match(gallery, /group\.title/);
  assert.match(gallery, /group\.images\.map/);
  assert.match(gallery, /topicTabs\.map/);
  assert.match(gallery, /mobileTourAll/);
  assert.match(gallery, /const identity = `\$\{item\.category\}\\u0000\$\{item\.topic\}\\u0000\$\{item\.src\}`/);
  assert.match(selection, /if \(topic\) return items\.filter/);
  assert.match(hook, /params\.set\("topic", topic\)/);
  assert.match(page, /openGallery\("units", unitGalleryStart, room\.name\)/);
  const ara = bundledDetails.details["vacation-2705"];
  assert.deepEqual(ara.galleryGroups.map((group) => group.title), [
    "גלריה כללית",
    "פנים הסוויטות",
    "מתחם הבריכה והחצר לכל סוויטה",
    "מתחם הבר המשותף",
  ]);
});

test("catalog state read failures reach the immutable accepted fallback", async () => {
  const source = await read("app/lib/public-catalog-read.ts");
  assert.match(source, /try\s*\{\s*state = await readSupplierCatalogState\(db, world\)/);
  assert.match(source, /public_catalog_state_fallback:\$\{world\}/);
  assert.match(source, /return withEditorialOverlays\(world, await publicSummaries\(world, bundled\(world\)\), await overlays\)/);
});

test("older accepted detail rows inherit newly supported gallery presentation fields", async () => {
  const { mergeBundledDetail } = await import("../app/lib/public-catalog-read.ts");
  const accepted = { name: "מתחם", galleryGroups: [], rooms: [{ id: 7, name: "סוויטה", images: [] }] };
  const bundled = { galleryGroups: [{ title: "מתחם הבריכה", images: ["/pool.jpg"] }], rooms: [{ id: 7, name: "סוויטה", images: ["/suite.jpg"] }] };
  const merged = mergeBundledDetail(accepted, bundled);
  assert.deepEqual(merged.galleryGroups, bundled.galleryGroups);
  assert.deepEqual(merged.rooms[0].images, ["/suite.jpg"]);
});

test("partially refreshed accepted detail rows keep every supplier gallery topic", async () => {
  const { mergeBundledDetail } = await import("../app/lib/public-catalog-read.ts");
  const accepted = { galleryGroups: [
    { title: "גלריה כללית", images: ["/runtime.jpg"] },
    { title: "מתחם הבריכה", images: ["/runtime-pool.jpg"] },
  ] };
  const bundled = { galleryGroups: [
    { title: "גלריה כללית", images: ["/bundled.jpg"] },
    { title: "פנים הסוויטות", images: ["/suite.jpg"] },
    { title: "מתחם הבריכה", images: ["/bundled-pool.jpg"] },
  ] };
  const merged = mergeBundledDetail(accepted, bundled);
  assert.deepEqual(merged.galleryGroups.map((group) => group.title), ["גלריה כללית", "מתחם הבריכה", "פנים הסוויטות"]);
  assert.deepEqual(merged.galleryGroups[0].images, ["/runtime.jpg"]);
});

test("a unit deep-link keeps a supplier-named gallery after media deduplication", async () => {
  const { visibleGalleryItems } = await import("../app/components/gallery-selection.ts");
  const items = [
    { src: "/suite.jpg", label: "סוויטה", category: "place", topic: "סוויטת אקווה" },
    { src: "/pool.jpg", label: "בריכה", category: "place", topic: "מתחם חוץ" },
  ];
  assert.deepEqual(visibleGalleryItems(items, "units", "סוויטת אקווה"), [items[0]]);
  assert.deepEqual(visibleGalleryItems(items, "place", "מתחם חוץ"), [items[1]]);
});

test("public review, accessibility and contact sources preserve their approved boundaries", async () => {
  const [reviewRoute, accessibility, contact, floating, eventPlace] = await Promise.all([
    read("app/api/reviews/route.ts"),
    read("app/components/listing-accessibility.tsx"),
    read("app/components/whatsapp-lead-button.tsx"),
    read("app/components/floating-contact-actions.tsx"),
    read("app/events/place/client-page.tsx"),
  ]);
  assert.doesNotMatch(reviewRoute, /authorizedCustomerSession|require.*login/i);
  assert.doesNotMatch(accessibility, /href=|<a\b/);
  assert.doesNotMatch(await read("app/business/client-page.tsx"), /href: "#accessibility"/);
  assert.match(contact, /businessPhone/);
  assert.doesNotMatch(contact, /businessPhone\s*\|\|\s*phone/);
  assert.match(eventPlace, /\.\.\.\(supplierDetail\.whatsapp \? \{ whatsapp: supplierDetail\.whatsapp \} : \{\}\)/);
  assert.match(floating, /DirectPhoneLink/);
  assert.match(floating, /WhatsAppLeadButton/);
  assert.match(floating, /floating-contact-actions__online/);
  assert.doesNotMatch(floating, /window\.scrollY\s*>/);
  assert.doesNotMatch(floating, /\.property-booking/);
  assert.match(floating, /property-title__actions--contact/);
  const operations = await read("app/api/admin/operations/route.ts");
  assert.match(operations, /FROM guest_reviews/);
  assert.match(operations, /author, rating, status, created_at/);
  const english = await read("app/i18n/translations.en.generated.json");
  assert.doesNotMatch(english, /Vii/);
});

test("Biz reporting uses one server run identity, truthful coverage and typed persistent sorting", async () => {
  const [page, route, runs, cache] = await Promise.all([
    read("app/admin/business-performance/page.tsx"),
    read("app/api/admin/business-performance/route.ts"),
    read("app/lib/biz-report-runs.ts"),
    read("app/lib/biz-conversion-cache.ts"),
  ]);
  assert.match(page, /payload\.run\.jobId/);
  assert.match(page, /payload\.run\.processed/);
  assert.match(page, /הסיכום כרגע חלקי/);
  assert.match(page, /localStorage\.setItem\(reportViewKey/);
  assert.match(page, /aria-sort=/);
  assert.match(page, /left === null \? 1 : -1/);
  assert.match(route, /updateBizReportRun/);
  const migration = await read("drizzle/0011_strong_roland_deschain.sql");
  assert.match(migration, /`job_id` text PRIMARY KEY NOT NULL/);
  assert.match(cache, /all-portals-v2/);
  assert.doesNotMatch(route, /sectionOnly:\s*true/);
  assert.match(page, /uniqueBizSummaries/);
  assert.match(route, /`\$\{target\.world\}:\$\{target\.siteID\}`/);
});

test("the deployed migration provisions every Biz report cache table without replaying older map schema", async () => {
  const migration = await read("drizzle/0011_strong_roland_deschain.sql");
  for (const table of [
    "vii_admin_report_cache_v1",
    "vii_biz_conversion_contacts_v1",
    "vii_biz_conversion_coverage_v1",
    "vii_biz_conversion_failures_v1",
    "vii_biz_conversion_snapshots_v1",
    "vii_biz_report_runs_v1",
  ]) assert.ok(migration.includes(`CREATE TABLE IF NOT EXISTS \`${table}\``), `missing additive migration for ${table}`);
  assert.doesNotMatch(migration, /CREATE TABLE(?: IF NOT EXISTS)? `vii_map_snapshots_v1`/);
});

test("Biz report requests verify migrated cache schema without runtime DDL", async () => {
  const [cache, reportCache, runs] = await Promise.all([
    read("app/lib/biz-conversion-cache.ts"),
    read("app/lib/admin-report-cache.ts"),
    read("app/lib/biz-report-runs.ts"),
  ]);
  for (const source of [cache, reportCache, runs]) {
    assert.doesNotMatch(source, /CREATE TABLE IF NOT EXISTS/);
    assert.doesNotMatch(source, /db\.prepare\(["'`]ALTER TABLE/);
  }
  assert.match(cache, /SELECT cache_key FROM vii_biz_conversion_snapshots_v1 LIMIT 1/);
  assert.match(reportCache, /SELECT cache_key FROM vii_admin_report_cache_v1 LIMIT 1/);
  assert.match(runs, /SELECT unsupported_count FROM vii_biz_report_runs_v1 LIMIT 1/);
  const route = await read("app/api/admin/business-performance/route.ts");
  assert.match(route, /cacheDiagnostic/);
  assert.match(reportCache, /diagnostic/);
  const runtimeDatabase = await read("app/lib/runtime-database.ts");
  const awsDatabase = await read("app/lib/aws-database.ts");
  assert.match(runtimeDatabase, /d1FallbackForRuntimeEnv/);
  assert.match(awsDatabase, /remoteAdapters/);
  assert.match(awsDatabase, /fallbackBindings/);
  assert.match(awsDatabase, /Symbol\.for\("vii\.awsDatabase\.d1Fallback"\)/);
  const worker = await read("worker/index.ts");
  assert.doesNotMatch(worker, /activateAwsDatabase/);
});

test("QQQAAA explains findings and exposes honest persisted progress", async () => {
  const [page, platform, runner] = await Promise.all([
    read("app/admin/quality/page.tsx"),
    read("app/lib/quality-platform.ts"),
    read("scripts/run-qqqaaa.cjs"),
  ]);
  for (const phrase of ["השפעה", "מה עושים עכשיו", "הבדיקה שמתבצעת עכשיו", "נותרו", "זמן שעבר"]) assert.match(page, new RegExp(phrase));
  assert.match(platform, /currentCheckId/);
  assert.match(platform, /UPDATE quality_runs SET total_checks/);
  assert.match(platform, /quality_schedule_overrides/);
  assert.match(platform, /updateQualitySchedule/);
  assert.match(page, /changeCadence/);
  assert.match(runner, /vii-unified-19/);
  assert.match(runner, /exclusions: \["accessibility", "typography"\]/);
});

