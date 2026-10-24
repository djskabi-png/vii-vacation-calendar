import test from "node:test";
import assert from "node:assert/strict";
import rules from "../scripts/multilingual-qa-rules.cjs";

const { analyzeTextSamples, findProhibitedCollisions, localizedRoute } = rules;

test("French QA rejects Hebrew leakage, raw dates and rejected literal copy", () => {
  const result = analyzeTextSamples([
    { selector: ".review", text: "היה לנו אירוח מעולה 2026-10-15" },
    { selector: ".search-label", text: "quand sors-tu" },
  ], "fr");
  assert.deepEqual(new Set(result.map((item) => item.kind)), new Set(["locale_script_leak", "unlocalized_date", "rejected_literal_copy"]));
});

test("native language-picker labels can be excluded before text analysis", () => {
  assert.deepEqual(analyzeTextSamples([{ selector: "main h1", text: "Toutes vos envies d’évasion" }], "fr"), []);
});

test("Russian QA permits Cyrillic but rejects Hebrew", () => {
  assert.equal(analyzeTextSamples([{ selector: "h1", text: "Идеальный отдых" }], "ru").length, 0);
  assert.equal(analyzeTextSamples([{ selector: "h1", text: "חופשה מושלמת" }], "ru")[0].kind, "locale_script_leak");
});

test("collision QA catches a card covering a heading without page overflow", () => {
  const collisions = findProhibitedCollisions(
    [{ elementId: "heading", selector: "h1", rect: { left: 20, top: 20, right: 520, bottom: 220 } }],
    [{ elementId: "card", selector: ".gift-hero__card", rect: { left: 450, top: 100, right: 850, bottom: 350 } }],
  );
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].kind, "visual_collision");
});

test("contained heading and card are not treated as a collision", () => {
  const collisions = findProhibitedCollisions(
    [{ elementId: "heading", selector: "article h2", rect: { left: 20, top: 20, right: 220, bottom: 80 } }],
    [{ elementId: "card", selector: "article", rect: { left: 0, top: 0, right: 300, bottom: 300 }, contains: ["heading"] }],
  );
  assert.equal(collisions.length, 0);
});

test("localized routes preserve query strings", () => {
  assert.equal(localizedRoute("/business?id=vacation-116", "fr"), "/fr/business?id=vacation-116");
  assert.equal(localizedRoute("/", "ru"), "/ru");
  assert.equal(localizedRoute("/guides", "he"), "/guides");
});
