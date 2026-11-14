import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("event date slider keeps its destination link and rail controls in the heading like vacation", () => {
  const eventSlider = read("app/components/event-last-minute.tsx");
  const eventRail = read("app/components/event-rail.tsx");
  const eventCss = read("app/worlds/events/styles/world-owned.css");

  assert.match(eventSlider, /<Link[^>]+>\{allLabel\}<\/Link><HomeSliderControls railId=\{railId\}/);
  assert.match(eventSlider, /<EventRail[^>]+railId=\{railId\} showControls=\{false\}/);
  assert.match(eventRail, /showControls \? <SliderRailControls/);
  assert.match(eventCss, /\.event-deals > \.section-head > div:last-child \{ display: flex; align-items: center; gap: 14px; \}/);
  assert.match(eventCss, /@media \(max-width: 760px\)[\s\S]*\.event-deals > \.section-head > div:last-child \{ width: 100%; justify-content: space-between; \}/);
});
