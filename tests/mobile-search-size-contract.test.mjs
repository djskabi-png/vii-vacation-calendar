import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("hourly search includes location and maximum price in its address", () => {
  assert.match(component, /searchParams\.get\("maxPrice"\)/);
  assert.match(component, /params\.set\("maxPrice"/);
  assert.match(component, /מחיר התחלתי עד/);
});

test("hourly mobile search fields share one equal grid and control height", () => {
  assert.match(styles, /\.search-box--hourly \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.search-box--hourly \.search-submit \{ grid-column: 1 \/ -1; width: 100%; \}/);
  assert.match(styles, /\.search-box--hourly \.search-field,\.search-box--hourly \.search-submit \{ min-height: 52px; \}/);
});
