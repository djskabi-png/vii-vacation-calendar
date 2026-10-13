import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const header = readFileSync(new URL("../app/site-header.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../app/components/page-shell.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const switcher = readFileSync(new URL("../app/components/world-switcher.tsx", import.meta.url), "utf8");

test("the world switcher belongs to the header action row beside the menu", () => {
  assert.match(header, /<div className="header-actions">[\s\S]*<WorldSwitcher active=\{activeWorld\}/);
  assert.match(header, /<WorldSwitcher active=\{activeWorld\}[\s\S]*className="menu-button"/);
  assert.doesNotMatch(shell, /<WorldSwitcher/);
});

test("the mobile world switcher is a compact forty-four pixel touch target", () => {
  assert.match(styles, /\.header-actions \.world-dock \{ position: relative; inset: auto; z-index: auto; flex: 0 0 44px; \}/);
  assert.match(styles, /\.world-dock > summary \{[\s\S]*width: 44px;[\s\S]*min-height: 44px/);
  assert.match(styles, /\.world-dock > summary > span:last-child \{ display: none; \}/);
  assert.match(switcher, /aria-label=\{translate\("חיפוש ובחירת עולם"\)\}/);
  assert.match(switcher, /<WorldSearchIcon \/>/);
  assert.match(switcher, /className="world-search-icon"/);
  assert.doesNotMatch(switcher, /localizedPath\("\/search", language\)/);
});
