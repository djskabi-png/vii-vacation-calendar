import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("mobile vacation and event toolbars use one compact filter and sort entry", async () => {
  const sources = await Promise.all([
    readFile(new URL("app/search/page.tsx", root), "utf8"),
    readFile(new URL("app/events/search/page.tsx", root), "utf8"),
  ]);
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  sources.forEach((source) => {
    assert.match(source, /mobile-filter__icon/);
    assert.match(source, /aria-expanded=\{filtersOpen\}/);
    assert.match(source, /<span>סינון<\/span>/);
    assert.match(source, /className="filter-panel__mobile-sort"/);
    assert.match(source, /className="results-toolbar__sort"/);
  });
  assert.match(css, /\.results-toolbar \{[\s\S]*min-height: 40px;[\s\S]*background: transparent;[\s\S]*box-shadow: none/);
  assert.match(css, /\.results-toolbar__actions \.mobile-filter \{[\s\S]*width: auto;[\s\S]*min-height: 40px;[\s\S]*border-radius: 999px;[\s\S]*background: #fff/);
  assert.match(css, /\.mobile-filter__icon i::after/);
  assert.match(css, /\.results-toolbar > \.results-toolbar__sort \{ display: none; \}/);
  assert.match(css, /\.filter-panel__mobile-sort \{ display: block;/);
});
