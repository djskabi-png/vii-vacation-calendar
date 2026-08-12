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
  assert.match(toggle, /const next = requested === "list" \? "list" : "grid"/);
  assert.doesNotMatch(toggle, /localStorage\.(?:getItem|setItem)/);
  assert.match(toggle, /url\.searchParams\.set\("view", "list"\)/);
  assert.match(toggle, /he: \{ label: "בחירת תצוגת תוצאות", grid: "כרטיסים", list: "רשימה" \}/);
  assert.match(toggle, /en: \{ label: "Choose results view", grid: "Grid", list: "List" \}/);
  assert.match(toggle, /ru: \{ label: "Выбор вида результатов", grid: "Плитка", list: "Список" \}/);
  assert.match(toggle, /fr: \{ label: "Choisir l’affichage des résultats", grid: "Grille", list: "Liste" \}/);
});

test("grid and list layouts cover desktop and narrow mobile cards", () => {
  assert.match(styles, /\.result-cards\.results-view--grid \{ grid-template-columns: repeat\(3/);
  assert.match(styles, /\.event-list\.results-view--grid \{ grid-template-columns: repeat\(3/);
  assert.match(styles, /\.discovery-grid\.results-view--list \.discovery-card \{ display: grid; grid-template-columns: 290px/);
  assert.match(styles, /@media \(max-width: 620px\)/);
  assert.match(styles, /\.result-cards\.results-view--list \.stay-card \{ grid-template-columns: 124px/);
  assert.match(styles, /\.results-toolbar \{ position: relative; z-index: 20; \}/);
  assert.match(styles, /font-family: Rubik, Heebo, Assistant, Arial, sans-serif/);
});
