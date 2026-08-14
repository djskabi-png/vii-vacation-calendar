import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("world navigation stays available throughout every public search flow", async () => {
  const [searchBox, switcher, vacationDates, eventDates, spaDates, styles] = await Promise.all([
    read("app/components/search-box.tsx"),
    read("app/components/world-switcher.tsx"),
    read("app/calendar-demo.tsx"),
    read("app/components/event-date-picker.tsx"),
    read("app/components/spa-date-picker.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(searchBox, /showWorlds = true/);
  assert.match(searchBox, /mobileExpanded && showWorlds && <div className="search-mobile-worlds">/);
  assert.doesNotMatch(searchBox, /mobileExpanded && showWorlds && !shouldCollapse/);
  assert.match(searchBox, /search-context-worlds/);
  assert.match(searchBox, /showWorlds && !shouldCollapse && !mobileExpanded/);
  assert.match(styles, /search-mobile-worlds . position: relative; z-index: 40;/);
  assert.match(styles, /mobile-expanded .location-list . top: 146px;/);
  assert.match(switcher, /onNavigate\?: \(\) => void/);
  assert.match(switcher, /router\.push\(href\)/);
  assert.match(switcher, /event\.preventDefault\(\)/);
  assert.match(switcher, /primaryWorlds = \["vacation", "spa", "events", "hourly"\]/);
  assert.match(switcher, /search-world-tabs__menu-head/);
  assert.match(switcher, /closeMoreAndRestoreFocus/);
  assert.match(switcher, /closeOnOutsidePress/);
  assert.match(switcher, /closeOnEscape/);
  assert.match(switcher, /aria-expanded=\{moreOpen\}/);
  assert.match(styles, /search-world-tabs__menu-head/);
  assert.match(styles, /max-height: calc\(100dvh - 96px\)/);
  assert.match(styles, /search-mobile-worlds \.search-world-tabs__menu \{ position: fixed; z-index: 1450; top: 144px/);
  assert.match(vacationDates, /SearchWorldTabs active="vacation" onNavigate=\{cancel\}/);
  assert.match(eventDates, /SearchWorldTabs active="events" onNavigate=\{cancel\}/);
  assert.match(spaDates, /SearchWorldTabs active="spa" onNavigate=\{cancel\}/);
  assert.match(styles, /\.search-world-tabs__options \{[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.search-dialog-worlds/);
});
