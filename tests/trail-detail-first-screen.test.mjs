import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/trails/[slug]/page.tsx", import.meta.url), "utf8");
const card = await readFile(new URL("../app/components/trail-card.tsx", import.meta.url), "utf8");

test("trail details answer the critical visit questions in the first screen", () => {
  assert.match(page, /aria-label="תקציר המסלול"/);
  assert.match(page, />איפה\?</);
  assert.match(page, />כמה זמן\?</);
  assert.match(page, />מה הקושי\?</);
  assert.match(page, />למי מתאים\?</);
  assert.match(page, />פתיחה במפה</);
  assert.match(page, />בדיקה במקור הרשמי</);
  assert.match(page, /faqSchema\(trailFaqs\)/);
});

test("generic trail artwork has no repeated visible disclosure badge and stays accurately described", () => {
  assert.doesNotMatch(card, /אינה צילום של המסלול/);
  assert.match(card, /aria-hidden="true"/);
});
