import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("hourly uses one filter system with state-driven headings", async () => {
  const [landing, results, heading, styles] = await Promise.all([
    readFile(new URL("app/components/world-landing.tsx", root), "utf8"),
    readFile(new URL("app/components/hourly-results.tsx", root), "utf8"),
    readFile(new URL("app/components/semantic-world-heading.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(landing, /world !== "spa" && world !== "hourly" && <WorldQuickSearches/);
  assert.match(landing, /world !== "spa" && world !== "hourly" && <div className="section-head world-results-title"/);
  assert.match(results, /<h2 aria-live="polite">\{resultLabel\}<\/h2>/);
  assert.doesNotMatch(results, /<h2>\{collectionTitle\}<\/h2>/);
  assert.match(results, /hourly-results__filters-head/);
  assert.match(heading, /const queryLocation = searchParams\.get\("location"\)/);
  assert.match(styles, /\.hourly-results__filters-head \{/);
});
