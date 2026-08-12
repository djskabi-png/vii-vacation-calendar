import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("every expanded world search exposes the shared gift voucher action", () => {
  assert.match(source, /search-mobile-sheet-head__actions/);
  assert.match(source, /className="search-gift-card-link"/);
  assert.match(source, /href=\{localizedPath\("\/gift-card", language\)\}/);
  assert.match(source, /translate\("קנה שובר מתנה"\)/);
  assert.match(source, /<GiftIcon \/>/);
});

test("gift voucher action and close control fit together on mobile", () => {
  assert.match(css, /\.search-box-shell \.search-mobile-sheet-head \{[^}]*grid-template-columns: minmax\(0,1fr\) auto;[^}]*display: grid;/s);
  assert.match(css, /\.search-mobile-sheet-head__actions \{[^}]*display: flex;[^}]*align-items: center;/s);
  assert.match(css, /\.search-gift-card-link \{[^}]*min-height: 40px;[^}]*font:[^}]*var\(--font-sans\)/s);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.search-mobile-sheet-head button \{ position: static !important; inset: auto !important; flex: 0 0 40px; \}/);
  assert.match(css, /\.search-gift-card-link \{[^}]*max-width: min\(180px,45vw\)/s);
});
