import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ADMIN_HIGHLIGHT_IDS, DEFAULT_ACTIVE_HIGHLIGHTS } from "../app/lib/admin-highlight-preferences.ts";
import { adminModules } from "../app/admin/access-policy.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("personal highlights expose exactly 24 choices and default to 16", () => {
  assert.equal(ADMIN_HIGHLIGHT_IDS.length, 24);
  assert.equal(new Set(ADMIN_HIGHLIGHT_IDS).size, 24);
  assert.equal(DEFAULT_ACTIVE_HIGHLIGHTS.length, 16);
  const board = read("../app/admin/admin-highlight-board.tsx");
  assert.match(board, /expanded \? 16 : 8/);
  assert.match(board, /סגירת שורות 3 ו־4/);
  assert.match(board, /הזמנה מכל כמה שיחות/);
  assert.match(board, /הסדר נשמר לחשבון המחובר/);
});

test("professor is an explicit permissioned module with quota, history and no invented Biz values", () => {
  assert.ok(adminModules.some((module) => module.id === "professor" && module.pages.includes("/admin/professor")));
  const engine = read("../app/lib/admin-professor.ts");
  const route = read("../app/api/admin/professor/route.ts");
  assert.match(engine, /daily_limit INTEGER NOT NULL DEFAULT 20/);
  assert.match(engine, /status = 'success'/);
  assert.match(engine, /נתוני Biz לטווח הזה עדיין לא נשמרו במטמון/);
  assert.match(route, /resolveAdminAccess/);
  assert.match(route, /manageUsers/);
  assert.match(route, /quota_exceeded/);
  assert.match(read("../app/admin/professor/page.tsx"), /ניהול מכסות פרופסור/);
});

test("identical units keep availability count and expose phone plus WhatsApp without replacing online booking", () => {
  const business = read("../app/business/client-page.tsx");
  assert.match(business, /availableIdenticalUnits > 0/);
  assert.match(business, /\{availableIdenticalUnits\} מתוך \{room\.quantity\} יחידות זהות פנויות/);
  assert.match(business, /חייגו להזמנה/);
  assert.match(business, /שלחו הודעה ב־WhatsApp/);
  assert.match(business, /initialDate=\{dateRange\.from\}/);
  assert.match(business, /initialTill=\{dateRange\.till\}/);
});

test("unit amenities wrap into two mobile rows and gallery arrows have one visible glyph", () => {
  const css = read("../app/globals.css");
  const gallery = read("../app/components/gallery-experience.tsx");
  assert.match(css, /\.room-card__amenities \{ display: grid; grid-template-columns: repeat\(4/);
  assert.match(css, /\.room-card__amenities \{ grid-template-columns: repeat\(2/);
  assert.match(css, /\.story-gallery__tap::before \{ display:none; \}/);
  assert.match(gallery, /story-gallery__tap-icon/);
});

test("non-place landing headings carry explicit search intent", () => {
  assert.match(read("../app/lib/event-landing-presentation.ts"), /מקומות לאירועים בישראל/);
  assert.match(read("../app/guides/page.tsx"), /מדריכי נופש, ספא ואירועים בישראל/);
  assert.match(read("../app/lib/world-landing-presentation.ts"), /חדרים לפי שעה בישראל/);
});
