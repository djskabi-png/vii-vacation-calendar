import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/search/search-tablet.css", import.meta.url), "utf8");

test("search results keep full framed cards across tablet widths", () => {
  assert.match(page, /import "\.\/search-tablet\.css"/);
  assert.match(css, /min-width:\s*821px[^}]+max-width:\s*1180px/s);
  assert.match(css, /stay-card__actions[^}]+grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /stay-card__details-link[^}]+grid-column:\s*1\s*\/\s*-1/s);
  assert.match(css, /results-list[\s\S]+stay-card__body[\s\S]+min-width:\s*0/);
});

test("narrow tablets move filters into an accessible drawer instead of squeezing cards", () => {
  assert.match(css, /min-width:\s*821px[^}]+max-width:\s*1100px/s);
  assert.match(css, /results-layout\.with-map[^}]+grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(css, /filter-panel:not\(\.static\)[^}]+position:\s*fixed/s);
  assert.match(css, /filter-panel\.open[^}]+display:\s*flex/s);
  assert.match(css, /mobile-filter[^}]+display:\s*inline-flex/s);
});
