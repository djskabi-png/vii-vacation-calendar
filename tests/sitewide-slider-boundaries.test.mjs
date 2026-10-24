import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sources = Object.fromEntries(await Promise.all([
  "slider-rail-controls",
  "home-slider-controls",
  "event-rail",
  "event-region-carousel",
  "search-after-results",
  "sleeping-arrangements",
  "property-card",
  "property-gallery",
  "gallery-experience",
].map(async (name) => [name, await readFile(new URL(`../app/components/${name}.tsx`, import.meta.url), "utf8")])));
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("every arrow-bearing content rail uses the shared geometry boundary model", () => {
  for (const name of ["home-slider-controls", "event-rail", "search-after-results", "sleeping-arrangements"]) {
    assert.match(sources[name], /SliderRailControls/, `${name} must use shared controls`);
  }
  assert.match(sources["event-region-carousel"], /useSliderRailBoundaries/);
  assert.match(sources["slider-rail-controls"], /const style = getComputedStyle\(rail\)/);
  assert.match(sources["slider-rail-controls"], /style\.direction === "rtl"/);
  assert.match(sources["slider-rail-controls"], /ResizeObserver/);
  assert.match(sources["slider-rail-controls"], /MutationObserver/);
  assert.match(sources["slider-rail-controls"], /rail\.addEventListener\("scroll", update/);
});

test("every indexed image slider clamps at both boundaries instead of wrapping", () => {
  for (const name of ["property-card", "property-gallery", "gallery-experience"]) {
    assert.match(sources[name], /boundedSliderIndex/);
    assert.doesNotMatch(sources[name], /\+ direction \+ [^)]+\.length\) %/);
  }
  assert.match(sources["property-card"], /disabled=\{imagePreviousDisabled\}/);
  assert.match(sources["property-card"], /disabled=\{imageNextDisabled\}/);
  assert.match(sources["property-gallery"], /disabled=\{selected === 0\}/);
  assert.match(sources["property-gallery"], /disabled=\{selected >= galleryImages\.length - 1\}/);
  assert.equal((sources["gallery-experience"].match(/disabled=\{selected === 0\}/g) || []).length, 2);
  assert.equal((sources["gallery-experience"].match(/disabled=\{selected >= visibleItems\.length - 1\}/g) || []).length, 2);
});

test("disabled controls are native, visible and non-interactive across the family", () => {
  assert.match(sources["slider-rail-controls"], /data-slider-controls/);
  assert.match(sources["property-card"], /data-slider-boundary/);
  assert.match(sources["property-gallery"], /data-slider-boundary/);
  assert.match(sources["gallery-experience"], /data-slider-boundary/);
  assert.match(css, /\[data-slider-controls\] button:disabled/);
  assert.match(css, /button\[data-slider-boundary\]:disabled[^}]*pointer-events: none/);
});

test("calendar arrows and horizontal navigation without slider arrows stay outside this change", () => {
  const combined = Object.values(sources).join("\n");
  assert.doesNotMatch(combined, /booking-schedule-picker|event-date-picker|spa-date-picker/);
});
