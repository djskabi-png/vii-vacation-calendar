import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("hourly mobile flows directly from the page introduction to a count toolbar", async () => {
  const [results, styles] = await Promise.all([
    readFile(new URL("../app/components/hourly-results.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(results, /<h2 aria-live="polite">\{resultLabel\}<\/h2>/);
  assert.doesNotMatch(results, /חדרים וסוויטות לפי שעה ב\$\{location\}/);
  assert.match(styles, /\.world-page--hourly \.world-page-heading \{ padding-bottom: 0; \}/);
  assert.match(styles, /\.world-page--hourly \.world-page-heading \+ \.section \{ padding-top: 8px; \}/);
});
