import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("optional homepage supplier reads are isolated from the document shell", () => {
  const source = read("app/page.tsx");
  assert.match(source, /bundledPublicCatalogSummaries<Property>\("vacations"\)\.catch\(\(\) => \[\]\)/);
  assert.match(source, /managedMagazineArticles\(magazineArticles\)\.catch\(\(\) => magazineArticles\)/);
  assert.match(read("app/error.tsx"), /Load again/);
  assert.match(read("app/global-error.tsx"), /Try again/);
});

test("place maps share a passive deferred loading contract", () => {
  for (const path of ["app/business/client-page.tsx", "app/events/place/client-page.tsx", "app/discover/place/client-page.tsx"]) {
    const source = read(path);
    assert.match(source, /Deferred(?:Listing|Discovery)Map/);
  }
  assert.doesNotMatch(read("app/events/place/client-page.tsx"), /single autoLoad/);
});

test("event details never publish zero-capacity claims", () => {
  const source = read("app/events/place/client-page.tsx");
  assert.match(source, /place\.guests > 0 \? <article><b>קיבולת<\/b>/);
  assert.match(source, /room\.guests > 0 \? `עד \$\{room\.guests\}/);
});

test("search depth media bypasses the failing runtime optimizer path", () => {
  assert.match(read("app/components/search-after-results.tsx"), /loading="lazy" unoptimized/);
});
