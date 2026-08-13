import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8");

test("vacation results introduce the result set before filters and sorting", () => {
  const heading = source.indexOf('<section className="results-heading">');
  const quickFilters = source.indexOf('<nav className="search-quick-filters"');
  const activeFilters = source.indexOf('className="active-filter-row"');
  const toolbar = source.indexOf('<div className="results-toolbar">');
  const cards = source.indexOf('className={`result-cards results-view results-view--${viewMode}`}');

  for (const [label, position] of Object.entries({ heading, quickFilters, activeFilters, toolbar, cards })) {
    assert.notEqual(position, -1, `missing ${label}`);
  }
  assert.ok(heading < quickFilters, "the result heading must precede the filter controls");
  assert.ok(quickFilters < activeFilters, "quick filters must precede the active-filter summary");
  assert.ok(activeFilters < toolbar, "active filters must precede sorting and view controls");
  assert.ok(toolbar < cards, "all result controls must precede the cards");
});
