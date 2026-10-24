import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public event rails and named-place suggestions never rely on raw supplier identity translation", () => {
  const events = read("app/events/page.tsx");
  const search = read("app/components/search-box.tsx");
  assert.match(events, /localizedBusinessText\(place\.name/);
  assert.match(events, /latinBusinessAlias\(place\.name\)/);
  assert.doesNotMatch(events, /name=\{translate\(place\.name\)\}/);
  assert.doesNotMatch(events, /<h3>\{translate\(place\.name\)\}<\/h3>/);
  assert.match(search, /localizedBusinessText\(place\.name/);
  assert.doesNotMatch(search, /<strong>\{translate\(place\.name\)\}<\/strong>/);
});

test("homepage keeps full layout measurable while media remains lazy", () => {
  const styles = read("app/site-polish.css");
  assert.match(styles, /\.home-worlds,[\s\S]*content-visibility:\s*visible;/);
  assert.doesNotMatch(styles, /\.home-worlds,[\s\S]{0,220}content-visibility:\s*auto;/);
});

test("slider boundaries are calculated from actual scroll progress in both directions", () => {
  const controls = read("app/components/slider-rail-controls.tsx");
  assert.match(controls, /maxScroll = Math\.max\(0, rail\.scrollWidth - rail\.clientWidth\)/);
  assert.match(controls, /Math\.abs\(rail\.scrollLeft\)/);
});
