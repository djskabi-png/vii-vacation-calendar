import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const sort = read("../app/lib/discovery-result-sort.ts");
const css = read("../app/mobile-polish.css");
const vacation = read("../app/search/page.tsx");
const events = read("../app/events/search/page.tsx");
const hourly = read("../app/components/hourly-results.tsx");
const spa = read("../app/components/world-map-results.tsx");
const providers = read("../app/components/provider-results.tsx");

test("recommended sorting uses a short human label in every language", () => {
  assert.match(sort, /he:\s*\{[^}]*recommended:\s*"מומלצים"/);
  assert.match(sort, /en:\s*\{[^}]*recommended:\s*"Recommended"/);
  assert.match(sort, /ru:\s*\{[^}]*recommended:\s*"Рекомендуемые"/);
  assert.match(sort, /fr:\s*\{[^}]*recommended:\s*"Recommandés"/);
  assert.doesNotMatch(sort, /recommended:\s*"מומלצים מתחלפים"/);
});

test("every discovery family opts into the compact sort and count contract", () => {
  for (const source of [vacation, events, hourly, spa, providers]) {
    assert.match(source, /discovery-sort-control/);
    assert.match(source, /discovery-results-count/);
  }
});

test("compact sorting hides the redundant label but preserves it for accessible naming", () => {
  assert.match(css, /\.discovery-sort-control \.modern-select__label\s*\{[^}]*position:\s*absolute[^}]*clip-path:\s*inset\(50%\)/s);
  assert.match(css, /\.discovery-sort-control\.modern-select--compact \.modern-select__trigger\s*\{[^}]*min-height:\s*40px/s);
  assert.match(css, /\.discovery-sort-control\.modern-select--compact \.modern-select__menu\s*\{[^}]*min-width:\s*190px/s);
});

test("mobile result count is restrained to two lines and selected sort text has contrast", () => {
  assert.match(css, /\.discovery-results-count\s*\{[^}]*font-size:\s*\.9rem\s*!important/s);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.discovery-results-count\s*\{[^}]*-webkit-line-clamp:\s*2/s);
  assert.match(css, /\.discovery-sort-control \.modern-select__trigger strong\s*\{[^}]*flex:\s*0 0 auto/s);
  assert.match(css, /\.spa-results__view-actions \.modern-select\.discovery-sort-control\s*\{[^}]*min-width:\s*118px[^}]*flex:\s*0 0 118px/s);
  assert.match(css, /\.modern-select__menu button\.is-selected > span,[\s\S]*?color:\s*#fff\s*!important/s);
});
