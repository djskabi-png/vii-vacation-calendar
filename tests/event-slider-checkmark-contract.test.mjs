import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [landing, detail, css, eventRail] = await Promise.all([
  readFile(new URL("../app/events/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/components/event-rail.tsx", import.meta.url), "utf8"),
]);

test("general event venue rail exposes the complete loaded catalog", () => {
  assert.match(landing, /<EventRail shufflePlaces warmAheadImages title=\{translate\("מקומות לאירועים"\)\}>\{eventPlaces\.map\(/);
  assert.doesNotMatch(landing, /eventPlaces\.slice\(0,\s*4\)/);
  assert.match(landing, /event-rail-card event-card event-world-card/);
  assert.doesNotMatch(css, /\.event-world-card \{[^}]*content-visibility:\s*auto;/s);
  assert.match(eventRail, /warmAheadImages[\s\S]*preloadDistance[\s\S]*new Image\(\)/);
  assert.match(eventRail, /dir=\{language === "he" \? "rtl" : "ltr"\}/);
});
test("event place feature cards use one centered vector checkmark", () => {
  assert.match(detail, /function EventFeatureCheck\(\)/);
  assert.equal((detail.match(/<EventFeatureCheck \/>/g) || []).length, 2);
  assert.doesNotMatch(detail, /<span key=\{feature\}>✓/);
  assert.match(css, /\.event-feature-check \{[^}]*display:\s*grid;[^}]*place-items:\s*center;[^}]*line-height:\s*0;/s);
  assert.match(css, /\.event-feature-check svg \{[^}]*width:\s*14px;[^}]*height:\s*14px;[^}]*display:\s*block;/s);
});
