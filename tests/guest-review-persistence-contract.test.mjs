import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("guest reviews use authenticated D1 and R2 persistence with pending moderation", async () => {
  const [route, storage, studio, schema, hosting] = await Promise.all([
    read("app/api/reviews/route.ts"),
    read("app/lib/review-storage.ts"),
    read("app/components/guest-review-studio.tsx"),
    read("db/schema.ts"),
    read(".openai/hosting.json"),
  ]);
  assert.match(route, /readSession\(request\)/);
  assert.match(route, /status: 201/);
  assert.match(route, /status = 'pending'|status, created_at/);
  assert.match(route, /MAX_PHOTOS = 8/);
  assert.match(route, /PHOTO_TYPES/);
  assert.match(route, /bucket\.put/);
  assert.match(storage, /env\.DB\.prepare/);
  assert.match(schema, /guestReviews/);
  assert.match(schema, /guestReviewFiles/);
  assert.deepEqual(JSON.parse(hosting), { project_id: "appgprj_6a71ccdca27481918bf04dd329d3eb21", d1: "DB", r2: "UPLOADS" });
  assert.doesNotMatch(studio, /localStorage/);
  assert.match(studio, /fetch\("\/api\/reviews"/);
  assert.match(studio, /aria-busy=\{submitting\}/);
  assert.match(studio, /name="photos"/);
});

test("the shared header keeps search visible and localized while mobile removes the redundant gift shortcut", async () => {
  const [header, styles] = await Promise.all([read("app/site-header.tsx"), read("app/globals.css")]);
  assert.match(header, /header-search/);
  assert.match(header, /localizedPath\("\/search", language\)/);
  assert.match(header, /translate\("חיפוש באתר"\)/);
  assert.match(styles, /\.header-actions \.header-gift \{ display: none; \}/);
});
