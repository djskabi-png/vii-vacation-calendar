import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { parseOpportunityChange, opportunityReadiness } from "../app/lib/search-opportunities.ts";

const page = fs.readFileSync(new URL("../app/admin/search-pages/page.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/find/[slug]/page.tsx", import.meta.url), "utf8");
const sitemap = fs.readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");

test("publishing requires complete content and a lowercase ASCII slug", () => {
  const complete = { id: "search-123", expectedVersion: 0, status: "published", assignee: "", title: "אירועים משפחתיים בחיפה", metaTitle: "אירועים משפחתיים בחיפה והכרמל",
    metaDescription: "מקומות לאירועים משפחתיים בחיפה והכרמל עם מידע מעשי, תמונות ודרכי פנייה ישירות.", h1: "מקומות לאירועים משפחתיים בחיפה והכרמל",
    summary: "מבחר מקומות שמתאימים לאירועים משפחתיים באזור חיפה והכרמל.", body: "בעמוד הזה ריכזנו מקומות פעילים מתוך קטלוג VII שמתאימים לחיפוש. אפשר להשוות בין המתחמים, לבדוק את התמונות והמאפיינים ולפתוח את עמוד המקום לפני שפונים אליו. המידע מתעדכן לפי הקטלוג הפעיל.",
    faq: [], slug: "events-haifa-carmel-family-event", robotsIndex: true, scheduledAt: null };
  assert.equal(opportunityReadiness(complete), 100);
  assert.equal(parseOpportunityChange(complete)?.status, "published");
  assert.equal(parseOpportunityChange({ ...complete, slug: "אירועים-בחיפה" }), null);
  assert.equal(parseOpportunityChange({ ...complete, body: "קצר" }), null);
});

test("admin studio exposes demand, content, SEO, scheduling, history and recovery controls", () => {
  for (const label of ["למה העמוד נוצר", "התוכן שהגולש יראה", "קידום, מנועי תשובות וכתובת", "פרסום עתידי", "גרסאות ויומן שינויים", "שמירת טיוטה", "פרסום עכשיו"]) assert.match(page, new RegExp(label));
  assert.match(page, /version_conflict/);
  assert.match(page, /מבקרים ייחודיים/);
});

test("published opportunity has a natural public destination and sitemap source", () => {
  assert.match(route, /publishedOpportunityBySlug/);
  assert.match(route, /collectionSchema/);
  assert.match(route, /מקומות שמתאימים לחיפוש/);
  assert.match(sitemap, /publishedOpportunityPaths/);
});
