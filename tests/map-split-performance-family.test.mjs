import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import { readMapImplementation } from "./helpers/map-implementation-source.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the shared map rail is bounded, preserves active selection, and scrolls it into view", () => {
  const list = read("app/components/map-split-result-list.tsx");
  assert.match(list, /MAP_SPLIT_RESULT_LIMIT = 18/);
  assert.match(list, /items\.slice\(0, limit\)/);
  assert.match(list, /items\.find\(\(item\) => getId\(item\) === activeId\)/);
  assert.match(list, /visible\.slice\(0, Math\.max\(0, limit - 1\)\), activeItem/);
  assert.match(list, /list\.scrollTo\(\{ top: list\.scrollTop \+ offset, behavior \}\)/);
  assert.doesNotMatch(list, /activeCard\?\.scrollIntoView/);
  assert.match(list, /prefers-reduced-motion: reduce/);
});

test("every map result family uses the shared bounded rail", () => {
  for (const path of [
    "app/search/page.tsx",
    "app/events/search/page.tsx",
    "app/components/world-map-results.tsx",
    "app/components/hourly-results.tsx",
    "app/attractions/attractions-explorer.tsx",
    "app/trails/trails-explorer.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /MapSplitResultList/);
  }
});

test("the desktop result rail scrolls independently and mobile keeps the map full screen", () => {
  const styles = readEffectiveWorldCss();
  assert.match(styles, /\.airbnb-map-split__results \{[^}]*max-height: calc\(100vh - 24px\)[^}]*overflow-y: auto[^}]*overscroll-behavior: contain/);
  assert.match(styles, /@media \(max-width: 1100px\)[\s\S]*\.airbnb-map-split__results \{ display: none; max-height: none; overflow: visible/);
});

test("only deliberate drag and zoom dirty the viewport", () => {
  const map = readMapImplementation();
  const resize = map.slice(map.indexOf("resizeObserver = new ResizeObserver"), map.indexOf("resizeObserver.observe(container)"));
  assert.doesNotMatch(resize, /reportVisiblePlaces\(true\)/);
  assert.match(resize, /const ids = visiblePlaceIds\(\);[\s\S]*?setPendingVisibleIds\(ids\)/);
  assert.match(resize, /!initialViewportReported && ids\.length > 0[\s\S]*?visiblePlaceIdsCallback\.current\?\.\(ids\)/);
  assert.match(map, /suppressProgrammaticViewportPrompt\(\);[\s\S]*?map\.fitBounds/);
  assert.match(map, /map\.on\("zoomend"[\s\S]*?reportVisiblePlaces\(true\)/);
  assert.match(map, /map\.on\("dragend"[\s\S]*?reportVisiblePlaces\(true\)/);
});
