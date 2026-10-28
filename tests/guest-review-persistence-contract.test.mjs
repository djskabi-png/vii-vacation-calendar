import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("guest reviews accept anonymous submissions into D1 and R2 with pending moderation", async () => {
  const [route, storage, studio, schema, hosting, operationsRoute, operationsPage] = await Promise.all([
    read("app/api/reviews/route.ts"),
    read("app/lib/review-storage.ts"),
    read("app/components/guest-review-studio.tsx"),
    read("db/schema.ts"),
    read(".openai/hosting.json"),
    read("app/api/admin/operations/route.ts"),
    read("app/admin/operations/page.tsx"),
  ]);
  assert.match(route, /readSession\(request\)/);
  assert.match(route, /review: null, authenticated: false/);
  assert.match(route, /const ownerId = session\?\.sub \|\| `guest:\$\{reviewId\}`/);
  assert.doesNotMatch(route, /כדי לשלוח חוות דעת ותמונות יש להתחבר עם גוגל/);
  assert.match(route, /status: 201/);
  assert.match(route, /status = 'pending'|status, created_at/);
  assert.match(route, /MAX_PHOTOS = 8/);
  assert.match(route, /PHOTO_TYPES/);
  assert.match(route, /bucket\.put/);
  assert.match(storage, /env\.DB\.prepare/);
  assert.match(schema, /guestReviews/);
  assert.match(schema, /guestReviewFiles/);
  assert.deepEqual(JSON.parse(hosting), { project_id: "appgprj_6a71ccdca27481918bf04dd329d3eb21", d1: "DB", r2: "UPLOADS", capabilities: ["mcp"] });
  assert.doesNotMatch(studio, /localStorage/);
  assert.doesNotMatch(studio, /api\/auth\/google/);
  assert.match(studio, /fetch\("\/api\/reviews"/);
  assert.match(studio, /aria-busy=\{submitting\}/);
  assert.match(studio, /name="photos"/);
  assert.match(operationsRoute, /export async function PATCH/);
  assert.match(operationsRoute, /UPDATE guest_reviews SET status = \?, updated_at = \?/);
  assert.match(operationsRoute, /UPDATE guest_review_files SET status = \?/);
  assert.match(operationsPage, /moderateReview/);
  assert.match(operationsPage, /> אישור</);
  assert.match(operationsPage, /> דחייה</);
});

test("the shared header keeps one worlds trigger, restores accessibility and adds one conditional search shortcut", async () => {
  const [header, styles] = await Promise.all([read("app/site-header.tsx"), read("app/globals.css")]);
  assert.match(header, /!hasInPageSearch \? <Link className="icon-button header-search"/);
  assert.match(header, /<AccessibilityWidget placement="icon" \/>/);
  assert.match(header, /<WorldSwitcher active=\{activeWorld\} \/>/);
  assert.match(styles, /\.header-actions \.header-gift \{ display: none; \}/);
});
