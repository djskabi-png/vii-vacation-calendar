import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("mobile vacation toolbar has a discreet filter and compact sort surface", async () => {
  const source = await readFile(new URL("app/search/page.tsx", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(source, /mobile-filter__icon/);
  assert.match(source, /aria-expanded=\{filtersOpen\}/);
  assert.match(source, /activeFilters\.length \? <b/);
  assert.match(css, /\.results-toolbar \{[\s\S]*min-height: 44px;[\s\S]*background: transparent;[\s\S]*box-shadow: none/);
  assert.match(css, /\.results-toolbar__actions \.mobile-filter \{[\s\S]*min-height: 44px;[\s\S]*background: #fff;[\s\S]*box-shadow: none/);
  assert.match(css, /\.mobile-filter__icon i::after/);
  assert.match(css, /\.results-toolbar > \.modern-select \.modern-select__trigger \{[\s\S]*background: #fff/);
});
