import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("spa mobile removes duplicate suggestions and compacts the functional filter rail", async () => {
  const [landing, css] = await Promise.all([
    readFile(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(landing, /searchMode && world !== "spa" && world !== "hourly" && <WorldQuickSearches/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.spa-results__landing-links a \{ width: 76px; min-height: 64px;/);
  assert.match(css, /\.spa-results__reset:disabled \{ display: none; \}/);
  assert.match(css, /\.spa-results__swipe-hint \{ display: none; \}/);
});
