import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

test("managed worlds delegate to canonical engines and retain semantic content", async () => {
  const landing = await readFile(new URL("../app/components/managed-search-landing.tsx", import.meta.url), "utf8");
  const world = await readFile(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8");
  assert.match(landing, /<EventSearchPage[\s\S]*initialSearchParams/);
  assert.match(landing, /<WorldLanding[\s\S]*managedBody=\{page\.body\}[\s\S]*managedFaq=\{page\.faq\}/);
  assert.match(landing, /initialSpaAudience=\{page\.world === "spa"/);
  assert.match(world, /<HourlyResults[\s\S]*initialFilters=\{initialFilters\}/);
  assert.match(world, /managed-search-editorial/);
});
