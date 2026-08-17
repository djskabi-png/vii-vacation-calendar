import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const results = readFileSync(new URL("../app/components/hourly-results.tsx", import.meta.url), "utf8");
const rates = readFileSync(new URL("../app/data/hourly-details.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("hourly search includes location and maximum price in its address", () => {
  assert.match(component, /searchParams\.get\("maxPrice"\)/);
  assert.match(component, /params\.set\("maxPrice"/);
  assert.match(component, /מחיר לשעתיים עד/);
  assert.match(component, /HOURLY_PRICE_OPTIONS = \[0, 250, 400, 600\]/);
  assert.match(component, /normalizeHourlyPrice\(searchParams\.get\("maxPrice"\)\)/);
});

test("hourly price filtering uses verified two-hour rates", () => {
  assert.match(results, /verifiedHourlyPrice\(item\.id, "שעתיים"\)/);
  assert.match(results, /const hourlyPriceOptions = \[0, 250, 400, 600\]/);
  assert.match(rates, /export function verifiedHourlyPrice/);
});

test("hourly mobile search fields share one equal grid and control height", () => {
  assert.match(styles, /\.search-box--hourly \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.search-box--hourly \.search-submit \{ grid-column: 1 \/ -1; width: 100%; \}/);
  assert.match(styles, /\.search-box-shell\.mobile-expanded \.search-submit \{[^}]*inset-inline: 14px;[^}]*width: auto;[^}]*max-width: none;[^}]*box-sizing: border-box;/);
  assert.match(styles, /\.search-box--hourly \.search-field,\.search-box--hourly \.search-submit \{ min-height: 52px; \}/);
  assert.match(styles, /\.world-hero__inner > \.search-box-shell \{ width: min\(100%,1040px\); \}/);
});
