import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("join flow ends with its real form action instead of a duplicate restart banner", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/join/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<PartnerOnboarding initialWorld=\{initialWorld\} \/>/);
  assert.doesNotMatch(page, /מוכנים לפתוח את העסק באתר\?/);
  assert.doesNotMatch(page, /href="#join-form">מתחילים עכשיו/);
  assert.doesNotMatch(styles, /\.join-final-cta/);
});
