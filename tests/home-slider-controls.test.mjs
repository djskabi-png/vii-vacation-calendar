import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controls = readFileSync(new URL("../app/components/home-slider-controls.tsx", import.meta.url), "utf8");
const sharedControls = readFileSync(new URL("../app/components/slider-rail-controls.tsx", import.meta.url), "utf8");
const showcase = readFileSync(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");
const discovery = readFileSync(new URL("../app/components/home-discovery-sections.tsx", import.meta.url), "utf8");
const deals = readFileSync(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("homepage rails share one geometry-aware boundary control", () => {
  assert.match(controls, /<SliderRailControls/);
  assert.match(sharedControls, /first\.right > bounds\.right \+ 2/);
  assert.match(sharedControls, /last\.left < bounds\.left - 2/);
  assert.match(sharedControls, /disabled=\{disabled \|\| !state\.previous\}/);
  assert.match(sharedControls, /disabled=\{disabled \|\| !state\.next\}/);
  assert.match(sharedControls, /ResizeObserver/);
  assert.match(sharedControls, /MutationObserver/);
  assert.match(sharedControls, /window\.addEventListener\("resize", update\)/);
});

test("every homepage content rail uses the shared controls", () => {
  assert.equal((showcase.match(/<HomeSliderControls/g) || []).length, 5);
  assert.equal((discovery.match(/<HomeSliderControls/g) || []).length, 1);
  assert.equal((deals.match(/<HomeSliderControls/g) || []).length, 1);
  assert.doesNotMatch(showcase, /function SliderControls/);
  assert.doesNotMatch(discovery, /const move =/);
});

test("disabled slider arrows are visibly and functionally inactive", () => {
  assert.match(css, /\.home-slider__controls button:hover:not\(:disabled\)/);
  assert.match(css, /\.home-slider__controls button:disabled \{[^}]*opacity:[^}]*cursor: default;/s);
  assert.match(css, /\[data-slider-controls\] button:disabled/);
});
