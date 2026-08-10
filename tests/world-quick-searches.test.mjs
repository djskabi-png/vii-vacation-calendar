import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(new URL("../app/components/world-quick-searches.tsx", import.meta.url), "utf8");
const landing = await readFile(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8");
const events = await readFile(new URL("../app/events/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("events, spa and hourly pages expose world-specific quick searches", () => {
  assert.match(component, /events:/);
  assert.match(component, /spa:/);
  assert.match(component, /hourly:/);
  assert.match(landing, /<WorldQuickSearches mode=\{searchMode\}/);
  assert.match(events, /<WorldQuickSearches mode="events"/);
});

test("every quick search is a crawlable link with a meaningful URL state", () => {
  assert.match(component, /eventType=יום\+הולדת/);
  assert.match(component, /guests=100/);
  assert.match(component, /\/spas\/couples-spa/);
  assert.match(component, /maxPrice=250/);
  assert.match(component, /עד 250 ₪ לשעתיים/);
  assert.match(component, /features=independent/);
  assert.doesNotMatch(component, /preventDefault/);
});

test("quick searches remain accessible and horizontally usable on mobile", () => {
  assert.match(component, /aria-label="חיפושים מהירים"/);
  assert.match(css, /\.world-quick-links a:focus-visible/);
  assert.match(css, /\.world-quick-links \{ width: 100%; flex-wrap: nowrap;/);
  assert.match(css, /min-height: 44px/);
});
