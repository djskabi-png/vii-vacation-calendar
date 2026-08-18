import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [calendar, business, data, concierge, css] = await Promise.all([
  readFile(new URL("../app/calendar-demo.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/components/smart-concierge.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("availability starts from the current day in Israel instead of a frozen demo date", () => {
  assert.match(calendar, /const SITE_TIME_ZONE = "Asia\/Jerusalem"/);
  assert.match(calendar, /export function currentSiteDay/);
  assert.match(calendar, /const DEMO_TODAY = currentSiteDay\(\)/);
  assert.match(calendar, /const START_MONTH = new Date\(DEMO_TODAY\.getFullYear\(\), DEMO_TODAY\.getMonth\(\), 1\)/);
  assert.match(business, /const today = currentSiteDay\(\)/);
  assert.doesNotMatch(calendar, /const DEMO_TODAY = new Date\(2026, 7, 4\)/);
  assert.doesNotMatch(business, /const today = new Date\(2026, 7, 4\)/);
});

test("mobile published reviews use a compact horizontal rail", () => {
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.review-experience__published \{[\s\S]*?grid-auto-flow: column;[\s\S]*?grid-auto-columns: min\(82vw, 288px\);[\s\S]*?overflow-x: auto;[\s\S]*?scroll-snap-type: inline mandatory;/);
  assert.match(css, /\.review-card--published \{ scroll-snap-align: start; \}/);
});

test("adjacent event sections use one mobile spacing rhythm", () => {
  assert.match(css, /\.events-page > \.event-region-section \{ padding-bottom: 24px; \}/);
  assert.match(css, /\.events-page > \.event-region-section \+ \.section \{ padding-top: 24px; \}/);
});

test("the floating concierge yields to footer content on phones", () => {
  assert.match(concierge, /new IntersectionObserver/);
  assert.match(concierge, /footerVisible \? "is-over-footer"/);
  assert.match(css, /\.smart-concierge\.is-over-footer \{ pointer-events: none; opacity: 0; transform: translateY\(12px\); \}/);
});

test("business FAQs speak to visitors without internal integration copy", () => {
  assert.match(data, /האישור הסופי מתקבל מהמקום/);
  assert.match(data, /לפני ההזמנה מקבלים מהמקום מחיר ותנאים מלאים/);
  assert.doesNotMatch(data, /בשלב החיבור למערכת הניהול/);
  assert.doesNotMatch(data, /יוצג לאחר חיבור מנוע ההזמנות/);
});
