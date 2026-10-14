import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { parseOpportunityChange, opportunityReadiness, saveOpportunity } from "../app/lib/search-opportunities.ts";
import { privateSearchPageEditorPath, publicSearchPagePath, publicationEligible } from "../app/lib/search-page-url-policy.ts";

const page = fs.readFileSync(new URL("../app/admin/search-pages/page.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/find/[slug]/page.tsx", import.meta.url), "utf8");
const publicRoute = fs.readFileSync(new URL("../app/search/[world]/[slug]/page.tsx", import.meta.url), "utf8");
const landing = fs.readFileSync(new URL("../app/components/managed-search-landing.tsx", import.meta.url), "utf8");
const sitemap = fs.readFileSync(new URL("../app/lib/sitemap-inventory.ts", import.meta.url), "utf8");
const complete = { id: "search-123", expectedVersion: 0, status: "published", assignee: "", title: "אירועים משפחתיים בחיפה", metaTitle: "אירועים משפחתיים בחיפה והכרמל",
  metaDescription: "מקומות לאירועים משפחתיים בחיפה והכרמל עם מידע מעשי, תמונות ודרכי פנייה ישירות.", h1: "מקומות לאירועים משפחתיים בחיפה והכרמל",
  summary: "מבחר מקומות שמתאימים לאירועים משפחתיים באזור חיפה והכרמל.", body: "בעמוד הזה ריכזנו מקומות פעילים מתוך קטלוג VII שמתאימים לחיפוש. אפשר להשוות בין המתחמים, לבדוק את התמונות והמאפיינים ולפתוח את עמוד המקום לפני שפונים אליו. המידע מתעדכן לפי הקטלוג הפעיל.",
  faq: [], slug: "family-event-haifa-carmel", robotsIndex: true, scheduledAt: null };

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(fs.readFileSync(new URL("../drizzle/0006_search_intelligence.sql", import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));
  return { sqlite, db: { prepare(sql) { let values = []; return { bind(...next) { values = next; return this; }, async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; }, async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); } } };
}

test("publishing requires complete content and a lowercase ASCII slug", () => {
  assert.equal(opportunityReadiness(complete), 100);
  assert.equal(parseOpportunityChange(complete)?.status, "published");
  assert.equal(parseOpportunityChange({ ...complete, slug: "אירועים-בחיפה" }), null);
  assert.equal(parseOpportunityChange({ ...complete, body: "קצר" }), null);
  assert.equal(parseOpportunityChange({ ...complete, robotsIndex: false }), null);
});

test("a new draft preserves the last live publication and archive removes it", async () => {
  const { sqlite, db } = database();
  const now = new Date().toISOString();
  sqlite.prepare(`INSERT INTO vii_search_page_opportunities
    (id, canonical_key, world, locale, location, filters_json, source_path, proposed_path, suggested_title,
     latest_result_count, first_seen_at, last_seen_at, search_count, zero_result_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("search-123", "intent-123", "events", "he", "חיפה והכרמל", JSON.stringify({ eventType: "אירוע משפחתי" }),
      "/events/search/haifa-carmel", "/search/events/family-event-haifa-carmel", "מקומות לאירועים משפחתיים בחיפה", 5, now, now, 3, 0);
  assert.ok(!("error" in await saveOpportunity(db, complete, "admin@vii.co.il")));
  const live = sqlite.prepare("SELECT canonical_path, snapshot_json FROM vii_search_page_publications WHERE opportunity_id = ?").get("search-123");
  assert.equal(live.canonical_path, "/search/events/family-event-haifa-carmel");
  assert.equal(JSON.parse(live.snapshot_json).status, "published");
  assert.ok(!("error" in await saveOpportunity(db, { ...complete, expectedVersion: 1, status: "draft" }, "admin@vii.co.il")));
  assert.equal(JSON.parse(sqlite.prepare("SELECT snapshot_json FROM vii_search_page_publications WHERE opportunity_id = ?").get("search-123").snapshot_json).status, "published");
  assert.ok(!("error" in await saveOpportunity(db, { ...complete, expectedVersion: 2, status: "archived" }, "admin@vii.co.il")));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM vii_search_page_publications").get().count, 0);
});

test("URL lifecycle separates private drafts from stable localized public editions", () => {
  assert.equal(privateSearchPageEditorPath("search-abc"), "/admin/search-pages?id=search-abc");
  assert.equal(publicSearchPagePath("spa", "couples-tel-aviv"), "/search/spas/couples-tel-aviv");
  assert.equal(publicSearchPagePath("spa", "couples-tel-aviv", "en"), "/en/search/spas/couples-tel-aviv");
  assert.equal(publicationEligible("draft", true, null), false);
  assert.equal(publicationEligible("published", false, null), false);
  assert.equal(publicationEligible("published", true, null), true);
  assert.equal(publicationEligible("scheduled", true, "2030-01-01T00:00:00.000Z", Date.parse("2029-01-01T00:00:00.000Z")), false);
});

test("admin studio exposes demand, content, SEO, scheduling, history and recovery controls", () => {
  for (const label of ["למה העמוד נוצר", "התוכן שהגולש יראה", "קידום, מנועי תשובות וכתובת", "פרסום עתידי", "גרסאות ויומן שינויים", "שמירת טיוטה", "פרסום עכשיו"]) assert.match(page, new RegExp(label));
  assert.match(page, /version_conflict/);
  assert.match(page, /מבקרים ייחודיים/);
  assert.match(page, /בדיקות שלי/);
  assert.match(page, /בדיקות של מנהל מחובר מוצגות בנפרד/);
  assert.match(page, /כתובת ניהול פרטית/);
  assert.match(page, /כתובת שתופעל בפרסום/);
  assert.match(page, /url_conflict/);
});

test("published opportunity has a natural public destination and sitemap source", () => {
  assert.match(route, /publishedOpportunityBySlug/);
  assert.match(route, /permanentRedirect/);
  assert.match(publicRoute, /publishedOpportunityByPath/);
  assert.match(landing, /collectionSchema/);
  assert.match(landing, /מקומות שמתאימים לחיפוש/);
  assert.match(sitemap, /publishedOpportunityPaths/);
  assert.match(sitemap, /opportunityPaths\.map/);
});
