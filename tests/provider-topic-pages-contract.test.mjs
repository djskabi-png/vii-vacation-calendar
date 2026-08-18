import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("provider topics use dedicated routed pages", () => {
  const categories = read("app/data/provider-categories.ts");
  const route = read("app/providers/[category]/page.tsx");
  const results = read("app/components/provider-results.tsx");
  const landing = read("app/components/world-landing.tsx");

  for (const slug of ["food", "music", "entertainment", "photo", "design", "bar", "wellness"]) {
    assert.match(categories, new RegExp(`id: "${slug}"`));
  }
  assert.match(route, /generateMetadata/);
  assert.match(route, /alternates: \{ canonical: path \}/);
  assert.match(route, /providerMatchesCategory/);
  assert.match(categories, /providerCategoryAssignments/);
  assert.match(categories, /"argaman-events": \["photo", "design"\]/);
  assert.match(results, /<Link key=\{entry\.id\} href=\{providerCategoryHref\(entry\)\}/);
  assert.doesNotMatch(results, /pushState\([^)]*category/);
  assert.match(landing, /world !== "providers"/);
});

test("legacy provider category links were replaced with routed paths", () => {
  const footer = read("app/data/footer-context.ts");
  const related = read("app/components/search-after-results.tsx");
  assert.doesNotMatch(`${footer}\n${related}`, /\/providers\?category=/);
  assert.match(footer, /\/providers\/food/);
  assert.match(related, /\/providers\/entertainment/);
});
