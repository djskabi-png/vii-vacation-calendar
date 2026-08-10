import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const hook = read("../app/components/map-view-state.ts");
const styles = read("../app/globals.css");
const consumers = [
  "../app/search/page.tsx",
  "../app/events/search/page.tsx",
  "../app/attractions/attractions-explorer.tsx",
  "../app/components/hourly-results.tsx",
  "../app/components/world-map-results.tsx",
].map(read);

test("mobile map overlay locks and restores the exact page position", () => {
  assert.match(hook, /scrollPosition\.current = window\.scrollY/);
  assert.match(hook, /body\.style\.position = "fixed"/);
  assert.match(hook, /body\.style\.top = `-\$\{scrollPosition\.current\}px`/);
  assert.match(hook, /window\.scrollTo\(0, scrollPosition\.current\)/);
  assert.match(hook, /if \(typeof window !== "undefined"\) scrollPosition\.current = window\.scrollY/);
  for (const source of consumers) assert.match(source, /useMapViewState/);
});

test("the full mobile map control is one stable hit target", () => {
  assert.match(styles, /\.mobile-map-fab > \* \{ pointer-events: none; \}/);
  assert.match(styles, /@media \(max-width: 760px\) and \(hover: hover\) and \(pointer: fine\)/);
});

test("the desktop map control toggles back to the list", () => {
  assert.match(consumers[0], /if \(mapOpen\) closeMap\(\)/);
});

test("map controls and markers use the site typography", () => {
  assert.match(styles, /\.listing-map-shell[^}]+font-family: Rubik, Heebo, Assistant, Arial, sans-serif/);
  assert.match(styles, /\.vii-map-marker[^}]+font-family: Rubik, Heebo, Assistant, Arial, sans-serif/);
  assert.match(styles, /\.map-search-area[^}]+font-family: Rubik, Heebo, Assistant, Arial, sans-serif/);
  assert.match(styles, /\.map-mobile-close[^}]+font-family: Rubik, Heebo, Assistant, Arial, sans-serif/);
  assert.doesNotMatch(styles, /\.listing-map-shell[^}]+font-family: Heebo, Arial, sans-serif/);
});
