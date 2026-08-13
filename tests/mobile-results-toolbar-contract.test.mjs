import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("mobile vacation and event headings use the single quick-filter entry", async () => {
  const sources = await Promise.all([
    readFile(new URL("app/search/page.tsx", root), "utf8"),
    readFile(new URL("app/events/search/page.tsx", root), "utf8"),
  ]);
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  sources.forEach((source) => {
    assert.match(source, /className="results-heading__meta"/);
    assert.doesNotMatch(source, /mobile-filter--compact/);
    assert.match(source, /className="filter-panel__mobile-sort"/);
    assert.match(source, /className="results-toolbar__sort"/);
  });
  assert.match(css, /\.results-toolbar \{[\s\S]*min-height: 0;[\s\S]*height: 0;[\s\S]*background: transparent;[\s\S]*box-shadow: none/);
  assert.match(css, /\.results-toolbar > \.results-toolbar__sort \{ display: none; \}/);
  assert.match(css, /\.filter-panel__mobile-sort \{ display: block;/);
});

test("mobile result headings wrap inside the viewport", async () => {
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(styles, /\.results-page \.results-heading > div \{ width: 100%; min-width: 0; \}/);
  assert.match(styles, /\.results-page \.results-heading h1 \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-wrap: anywhere;/);
});

test("mobile quick filters scroll with the result page instead of covering cards", async () => {
  const mobileCss = await readFile(new URL("app/mobile-stability.css", root), "utf8");
  assert.match(mobileCss, /\.search-quick-filters \{[\s\S]*position: static;[\s\S]*top: auto;[\s\S]*z-index: auto;/);
});
