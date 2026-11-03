import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("the approved contextual landing family cannot disappear from a release source", () => {
  for (const path of [
    "app/events/last-minute/page.tsx",
    "app/spas/today/page.tsx",
    "app/spas/tomorrow/page.tsx",
  ]) assert.equal(existsSync(new URL(path, root)), true, `missing approved route source: ${path}`);

  const events = read("app/events/last-minute/page.tsx");
  const spaToday = read("app/spas/today/page.tsx");
  const spaTomorrow = read("app/spas/tomorrow/page.tsx");
  assert.match(events, /EventLastMinute/);
  assert.match(spaToday, /SpaDealDayPage/);
  assert.match(spaTomorrow, /SpaDealDayPage/);
});

test("spa booking remains contained inside VII", () => {
  const place = read("app/discover/place/client-page.tsx");
  const spaDetails = read("app/data/spa-details.ts");
  const booking = read("app/booking/page.tsx");
  assert.match(place, /function SpaBookingDialog/);
  assert.match(place, /createPortal/);
  assert.match(place, /<iframe/);
  assert.match(place, /onBook=\{/);
  assert.match(spaDetails, /searchParams\.set\("isFrame", "1"\)/);
  assert.match(spaDetails, /searchParams\.set\("domainSrc", "vii"\)/);
  assert.match(booking, /redirect\(`\/discover\/place\/\$\{encodeURIComponent\(placeId\)\}\?booking=/);
});

test("the approved vacation place-detail family remains in the baseline", () => {
  const place = read("app/business/client-page.tsx");
  const hub = read("app/components/vacation-booking-hub.tsx");
  assert.match(place, /RoomSleepingPreview/);
  assert.match(place, /room-card__area/);
  assert.match(place, /property-about__toggle/);
  assert.match(place, /הזמינות ביחידה זו נבדקת בטלפון/);
  assert.match(hub, /vacation-booking-hub--inquiry-only/);
  assert.match(hub, /stay-card__contact--whatsapp/);
  assert.match(hub, /failedUnitImages/);
  assert.match(hub, /unitActionLabel/);
});

test("later SEO, Professor, administration and policy work remains in the same baseline", () => {
  assert.equal(existsSync(new URL("app/data/legacy-place-agreements.json", root)), true);
  assert.equal(existsSync(new URL("app/api/content/world-availability/route.ts", root)), true);
  assert.match(read("app/search/page.tsx"), /propertyAccommodationTypes/);
  assert.match(read("app/lib/sergey-public-catalog-client.ts"), /accommodationTypes/);
  assert.match(read("app/lib/admin-professor.ts"), /interpretProfessorQuestion/);
  assert.match(read("app/admin/professor/page.tsx"), /ProfessorBidiText/);
  assert.match(read("app/admin/catalog-sync/page.tsx"), /catalog/i);
});

test("the release source gate and every accepted capability manifest remain present", () => {
  const manifest = JSON.parse(read("project_knowledge/release_controls/vii-accepted-capabilities.json"));
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(manifest.protectedAncestors.length >= 5);
  assert.ok(manifest.requiredCapabilities.length >= 10);
  for (const capability of manifest.requiredCapabilities) {
    assert.ok(capability.id);
    for (const path of capability.files) assert.equal(existsSync(new URL(path, root)), true, `${capability.id} lost ${path}`);
  }
  assert.match(read("scripts/run-qqqaaa.cjs"), /release-source-integrity/);
  assert.match(read("scripts/run-qqqaaa.cjs"), /exclusions: \[\]/);
});
