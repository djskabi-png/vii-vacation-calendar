import assert from "node:assert/strict";
import test from "node:test";
import { publicCatalogEntryAllowed } from "../app/lib/public-catalog-policy.ts";
import { publicSearchOpportunityAllowed } from "../app/lib/search-opportunities.ts";
import { publicHomeDealAllowed } from "../app/lib/vii-home-deals.ts";

test("internal supplier fixtures never reach public catalog consumers", () => {
  assert.equal(publicCatalogEntryAllowed({ name: "המתחם הקטלני של רועי", contact: { phone: "050-1234567" } }), false);
  assert.equal(publicCatalogEntryAllowed({ name: "test4", contact: { phone: "050-5555555" } }), false);
  assert.equal(publicCatalogEntryAllowed({ name: "וילה אמיתית", contact: { phone: "050-5555555" } }), true);
});

test("cached homepage availability applies the same fixture guard at the final deal boundary", () => {
  assert.equal(publicHomeDealAllowed({ name: "המתחם הקטלני של רועי", phone: "050-1234567" }), false);
  assert.equal(publicHomeDealAllowed({ name: "test4", phone: "050-1234567" }), false);
  assert.equal(publicHomeDealAllowed({ name: "מקום אמיתי", phone: "050-7654321" }), true);
});

test("malformed or empty managed pages are not publicly eligible", () => {
  const valid = { title: "נופש למשפחות בגליל", metaTitle: "נופש למשפחות בגליל | VII", metaDescription: "מקומות נופש למשפחות בגליל עם מידע שימושי, תמונות וקישורים ישירים.", h1: "נופש למשפחות בגליל", summary: "מבחר מקומות שמתאימים למשפחות באזור הגליל.", body: "מידע שימושי ומפורט לבחירת מקום נופש למשפחה בגליל, כולל מתקנים, אזור ודרכי יצירת קשר.", latestResultCount: 4 };
  assert.equal(publicSearchOpportunityAllowed(valid), true);
  assert.equal(publicSearchOpportunityAllowed({ ...valid, summary: "נופש בפוריה שנבדק ואושר על ידי מיזם V..." }), false);
  assert.equal(publicSearchOpportunityAllowed({ ...valid, h1: "נופש ב עם מתאים לאירועים" }), false);
  assert.equal(publicSearchOpportunityAllowed({ ...valid, latestResultCount: 0 }), false);
});
