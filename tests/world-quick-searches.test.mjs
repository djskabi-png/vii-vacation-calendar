import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(new URL("../app/components/world-quick-searches.tsx", import.meta.url), "utf8");
const eventComponent = await readFile(new URL("../app/components/event-quick-searches.tsx", import.meta.url), "utf8");
const eventPresentation = await readFile(new URL("../app/lib/event-landing-presentation.ts", import.meta.url), "utf8");
const landing = await readFile(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8");
const events = await readFile(new URL("../app/events/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("events, spa and hourly pages expose world-specific quick searches", () => {
  assert.match(eventPresentation, /searchHref\(\{ eventType: "יום הולדת" \}\)/);
  assert.match(component, /spa:/);
  assert.match(component, /hourly:/);
  assert.match(landing, /<WorldQuickSearches mode=\{searchMode\}/);
  assert.match(events, /<EventQuickSearches/);
});

test("every quick search is a crawlable link with a meaningful URL state", () => {
  assert.match(eventPresentation, /new URLSearchParams\(params\)\.toString\(\)/);
  assert.match(eventPresentation, /searchHref\(\{ eventType: "יום הולדת" \}\)/);
  assert.match(eventPresentation, /guests=100/);
  assert.match(component, /\/spas\/couples-spa/);
  assert.match(component, /maxPrice=250/);
  assert.match(component, /עד 250 ₪ לשעתיים/);
  assert.match(component, /features=independent/);
  assert.doesNotMatch(component, /preventDefault/);
  assert.match(eventComponent, /<Link key=\{item\.id\} href=\{item\.href\}/);
});

test("quick searches remain accessible and horizontally usable on mobile", () => {
  assert.match(component, /aria-label="חיפושים מהירים"/);
  assert.match(css, /\.world-quick-links a:focus-visible/);
  assert.match(css, /\.world-quick-links \{ width: 100%; flex-wrap: nowrap;/);
  assert.match(css, /min-height: 44px/);
  assert.match(eventComponent, /HomeSliderControls/);
  assert.match(eventComponent, /data-horizontal-rail/);
  assert.match(css, /\.event-quick-searches__rail/);
});
