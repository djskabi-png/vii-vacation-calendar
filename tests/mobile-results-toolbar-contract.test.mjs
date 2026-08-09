import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("mobile vacation toolbar has a branded filter and compact sort surface", async () => {
  const source = await readFile(new URL("app/search/page.tsx", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(source, /mobile-filter__icon/);
  assert.match(source, /aria-expanded=\{filtersOpen\}/);
  assert.match(source, /activeFilters\.length \? <b/);
  assert.match(css, /\.results-toolbar \{[\s\S]*border-radius: 20px;[\s\S]*box-shadow: 0 12px 32px/);
  assert.match(css, /\.results-toolbar__actions \.mobile-filter \{[\s\S]*linear-gradient\(135deg,#087e8b,#168eb5\)/);
  assert.match(css, /\.mobile-filter__icon i::after/);
  assert.match(css, /\.results-toolbar > \.modern-select \.modern-select__trigger \{[\s\S]*background: #f2f7f8/);
});
