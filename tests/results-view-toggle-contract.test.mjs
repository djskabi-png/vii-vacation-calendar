import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const toggle = readFileSync(new URL("../app/components/results-view-toggle.tsx", import.meta.url), "utf8");
const vacation = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const events = readFileSync(new URL("../app/events/search/page.tsx", import.meta.url), "utf8");
const spa = readFileSync(new URL("../app/components/world-map-results.tsx", import.meta.url), "utf8");
const hourly = readFileSync(new URL("../app/components/hourly-results.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/results-view.css", import.meta.url), "utf8");

test("all commercial result worlds share a grid-first view toggle", () => {
  assert.match(toggle, /useState<ResultsViewMode>\("grid"\)/);
  assert.match(vacation, /useResultsViewMode\("vacation"\)/);
  assert.match(events, /useResultsViewMode\("events"\)/);
  assert.match(spa, /useResultsViewMode\("spa"\)/);
  assert.match(hourly, /useResultsViewMode\("hourly"\)/);
  for (const source of [vacation, events, spa, hourly]) {
    assert.match(source, /<ResultsViewToggle value=\{viewMode\} onChange=\{setViewMode\}/);
    assert.match(source, /results-view--\$\{viewMode\}/);
  }
});

test("view choice is accessible, localized and grid-first on every fresh search", () => {
  assert.match(toggle, /aria-pressed=\{value === "grid"\}/);
  assert.match(toggle, /aria-pressed=\{value === "list"\}/);
  assert.match(toggle, /window\.matchMedia\("\(max-width: 820px\)"\)/);
  assert.match(toggle, /if \(mobileQuery\.matches\)[\s\S]*?setViewModeState\("grid"\)/);
  assert.match(toggle, /url\.searchParams\.delete\("view"\)/);
  assert.doesNotMatch(toggle, /localStorage\.(?:getItem|setItem)/);
  assert.match(toggle, /url\.searchParams\.set\("view", "list"\)/);
  assert.match(toggle, /he: \{ label: "בחירת תצוגת תוצאות", grid: "כרטיסים", list: "רשימה" \}/);
  assert.match(toggle, /en: \{ label: "Choose results view", grid: "Grid", list: "List" \}/);
  assert.match(toggle, /ru: \{ label: "Выбор вида результатов", grid: "Плитка", list: "Список" \}/);
  assert.match(toggle, /fr: \{ label: "Choisir l’affichage des résultats", grid: "Grille", list: "Liste" \}/);
});

test("desktop supports both layouts while mobile is always a clean card grid", () => {
  assert.match(styles, /\.result-cards\.results-view--grid \{ grid-template-columns: repeat\(3/);
  assert.match(styles, /\.event-list\.results-view--grid \{ grid-template-columns: repeat\(3/);
  assert.match(styles, /\.discovery-grid\.results-view--list \.discovery-card \{ display: grid; grid-template-columns: 290px/);
  assert.match(styles, /@media \(max-width: 620px\)/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*?\.results-view-toggle \{ display: none !important; \}/);
  assert.match(styles, /Defensive fallback for an old bookmarked URL/);
  assert.match(styles, /\.result-cards\.results-view--list \.stay-card,[\s\S]*?display: block/);
  assert.match(styles, /\.results-toolbar \{ position: relative; z-index: 20; \}/);
  assert.match(styles, /font-family: Rubik, Heebo, Assistant, Arial, sans-serif/);
  assert.match(styles, /\.spa-results__heading,[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.doesNotMatch(styles, /max-width: 620px[\s\S]*?\.results-view-toggle button \{ width: 42px/);
});

test("mobile page shells keep an app-like protected edge around headings and cards", () => {
  const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(globalStyles, /@media \(max-width: 560px\) \{[\s\S]*?\.shell \{ width: calc\(100% - 32px\); \}/);
});
