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

test("the mobile world switcher exposes the current topic and a chevron with a forty-four pixel touch height", () => {
  assert.match(styles, /\.header-actions \.world-dock \{ position: relative; inset: auto; z-index: auto; flex: 0 1 auto; \}/);
  assert.match(styles, /\.world-dock > summary \{[\s\S]*min-width: 68px;[\s\S]*min-height: 44px/);
  assert.doesNotMatch(styles, /\.world-dock > summary > span:last-child \{ display: none; \}/);
  assert.match(switcher, /headerWorldLabel\(active, language\)/);
  assert.match(switcher, /<WorldToggleIcon \/>/);
  assert.match(switcher, /className="world-toggle-icon"/);
  assert.doesNotMatch(switcher, /localizedPath\("\/search", language\)/);
});

test("the narrow header never wraps the world label and reserves room for the optional search action", () => {
  assert.match(styles, /\.world-dock > summary strong \{ font-size: \.72rem; line-height: 1\.25; overflow-wrap: normal; white-space: nowrap; \}/);
  assert.match(styles, /@media \(max-width: 560px\) \{[\s\S]*?\.world-dock > summary \{[\s\S]*?width: 80px;[\s\S]*?min-width: 80px;[\s\S]*?max-width: 80px;/);
  assert.match(styles, /@media \(max-width: 380px\) \{\s*\.site-header:has\(\.header-search\) \.header-actions > \.language-switcher \{ display: none; \}\s*\}/);
  assert.match(styles, /@media \(max-width: 340px\) \{[\s\S]*?\.world-dock > summary \.world-toggle-icon \{ display: block; \}/);
  assert.doesNotMatch(styles, /\.world-dock > summary strong \{[^}]*overflow-wrap: anywhere/);
});
