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

test("supplier gallery names and membership remain authoritative and shareable", async () => {
  const [gallery, selection, hook, page] = await Promise.all([
    read("app/components/gallery-experience.tsx"),
    read("app/components/gallery-selection.ts"),
    read("app/components/use-gallery-deep-link.ts"),
    read("app/business/client-page.tsx"),
  ]);
  assert.match(gallery, /property\.galleryGroups\?\.length/);
  assert.match(gallery, /group\.title/);
  assert.match(gallery, /group\.images\.map/);
  assert.match(gallery, /topicTabs\.map/);
  assert.match(gallery, /mobileTourAll/);
  assert.match(selection, /if \(topic\) return items\.filter/);
  assert.match(hook, /params\.set\("topic", topic\)/);
  assert.match(page, /openGallery\("units", unitGalleryStart, room\.name\)/);
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
  const [reviewRoute, accessibility, contact, floating] = await Promise.all([
    read("app/api/reviews/route.ts"),
    read("app/components/listing-accessibility.tsx"),
    read("app/components/whatsapp-lead-button.tsx"),
    read("app/components/floating-contact-actions.tsx"),
  ]);
  assert.doesNotMatch(reviewRoute, /authorizedCustomerSession|require.*login/i);
  assert.doesNotMatch(accessibility, /href=|<a\b/);
  assert.doesNotMatch(await read("app/business/client-page.tsx"), /href: "#accessibility"/);
  assert.match(contact, /businessPhone/);
  assert.doesNotMatch(contact, /businessPhone\s*\|\|\s*phone/);
  assert.match(floating, /DirectPhoneLink/);
  assert.match(floating, /WhatsAppLeadButton/);
  assert.match(floating, /floating-contact-actions__online/);
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
  assert.match(runs, /job_id TEXT PRIMARY KEY/);
  assert.match(cache, /all-portals-v2/);
  assert.doesNotMatch(route, /sectionOnly:\s*true/);
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

