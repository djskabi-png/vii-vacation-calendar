import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/lib/homepage-presentation.ts", import.meta.url), "utf8");

const expected = [
  ["וילות נופש", "/villas"],
  ["צימרים", "/zimmers"],
  ["דירות נופש", "/vacation-apartments"],
  ["סוויטות יוקרתיות", "/luxury-suites"],
  ["נופש ברגע האחרון", "/last-minute"],
  ["נופש למשפחה עם בריכה מחוממת", "heated-pool,families"],
  ["מקומות לאירועים", "/events"],
  ["חבילות ספא", "/spas#spa-world-package-deals"],
  ["חדרים לפי שעה", "/hourly"],
  ["לופטים", "/events/search?type=%D7%9C%D7%95%D7%A4%D7%98"],
];

test("homepage popular searches contain the requested ten destinations", () => {
  for (const [label, destination] of expected) {
    assert.match(source, new RegExp(label), `missing label: ${label}`);
    assert.ok(source.includes(destination), `missing destination for ${label}: ${destination}`);
  }
  const popularStart = source.indexOf("  popular: [");
  const popularEnd = source.indexOf("  cities: [", popularStart);
  const popularBlock = source.slice(popularStart, popularEnd);
  assert.equal((popularBlock.match(/visible: true/g) || []).length, 10);
});

test("the published four-card legacy list is upgraded without overriding future managed lists", () => {
  assert.match(source, /retiredPopularSearchIds = \["vacations", "pool", "events", "north"\]/);
  assert.match(source, /isRetiredPopularSearchList\(managedPopular\) \? defaults\.popular : managedPopular/);
});
