import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("vacation bedroom facts render as separate visible cards sourced from supplier room groups", () => {
  const business = read("../app/business/client-page.tsx");
  const sleeping = read("../app/components/verified-sleeping-details.tsx");

  assert.match(business, /property\.roomOptions \|\| \[\]\)\.flatMap/);
  assert.match(business, /room\.featureGroups \|\| \[\]/);
  assert.match(business, /isVerifiedBedroomGroup\(group\.title\)/);
  assert.match(business, /details: \[\.\.\.new Set\(group\.items\)\]/);
  assert.match(business, /<VerifiedSleepingDetails placeName=\{localizedPropertyName\} rooms=\{verifiedSleepingRooms\} \/>/);

  assert.match(sleeping, /<h2 id="sleeping-title">איפה תשנו\?<\/h2>/);
  assert.match(sleeping, /rooms\.map\(\(room\) => <article className="sleeping-card"/);
  assert.match(sleeping, /room\.details\.map/);
  assert.doesNotMatch(sleeping, /מיטה זוגית|מיטת יחיד|ספה נפתחת/);
});

test("hourly breadcrumb city uses an ASCII canonical landing", () => {
  const landings = read("../app/data/world-search-landings.ts");
  assert.match(landings, /"ראשון לציון": "rishon-lezion"/);
  assert.match(landings, /return distinct\.map\(\(value\) => \(\{ name: `חדרים לפי שעה ב\$\{value\}`, path: hourlySearchHref\(value\) \}\)\)/);
});
