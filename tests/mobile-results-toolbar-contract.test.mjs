import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("mobile vacation and event headings keep a compact filter beside the result count", async () => {
  const sources = await Promise.all([
    readFile(new URL("app/search/page.tsx", root), "utf8"),
    readFile(new URL("app/events/search/page.tsx", root), "utf8"),
  ]);
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  sources.forEach((source) => {
    assert.match(source, /mobile-filter__icon/);
    assert.match(source, /aria-expanded=\{filtersOpen\}/);
    assert.match(source, /className="results-heading__meta"/);
    assert.match(source, /mobile-filter--compact/);
    assert.match(source, /className="mobile-filter__label">סינון<\/span>/);
    assert.match(source, /className="filter-panel__mobile-sort"/);
    assert.match(source, /className="results-toolbar__sort"/);
  });
  assert.match(css, /\.results-toolbar \{[\s\S]*min-height: 0;[\s\S]*height: 0;[\s\S]*background: transparent;[\s\S]*box-shadow: none/);
  assert.match(css, /\.results-heading__meta \.mobile-filter \{[\s\S]*width: auto;[\s\S]*min-height: 40px;[\s\S]*min-width: 94px;[\s\S]*align-items: center;[\s\S]*border-radius: 14px;[\s\S]*background: #fff;[\s\S]*font-size: \.8rem;[\s\S]*line-height: 1/);
  assert.match(css, /\.mobile-filter b \{ position: static;/);
  assert.match(css, /\.mobile-filter__icon svg \{ width: 17px; height: 17px;[\s\S]*stroke-width: 1\.8/);
  assert.doesNotMatch(css, /\.mobile-filter__icon i::after/);
  assert.match(css, /\.results-toolbar > \.results-toolbar__sort \{ display: none; \}/);
  assert.match(css, /\.filter-panel__mobile-sort \{ display: block;/);
});
