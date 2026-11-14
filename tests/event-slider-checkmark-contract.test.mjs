import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [landing, detail, css, eventRail] = await Promise.all([
  readFile(new URL("../app/events/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8"),
  readEffectiveWorldCss(),
  readFile(new URL("../app/components/event-rail.tsx", import.meta.url), "utf8"),
]);

test("general event venue rail exposes the complete loaded catalog", () => {
  assert.match(landing, /<EventRail railId="event-places-rail" shufflePlaces warmAheadImages title=\{translate\("מקומות לאירועים"\)\}>\{eventPlaces\.map\(/);
  assert.doesNotMatch(landing, /eventPlaces\.slice\(0,\s*4\)/);
  assert.match(landing, /event-rail-card event-card event-world-card/);
  assert.doesNotMatch(css, /\.event-world-card \{[^}]*content-visibility:\s*auto;/s);
  assert.match(eventRail, /warmAheadImages[\s\S]*preloadDistance[\s\S]*new Image\(\)/);
  assert.match(eventRail, /dir=\{language === "he" \? "rtl" : "ltr"\}/);
});
test("event place feature cards use the shared centered semantic icon", () => {
  assert.match(detail, /import \{ UnifiedAmenityList \} from "\.\.\/\.\.\/components\/unified-amenity-list"/);
  assert.equal((detail.match(/<UnifiedAmenityList/g) || []).length, 1);
  assert.doesNotMatch(detail, /function EventFeatureCheck\(\)/);
  assert.doesNotMatch(detail, /<span key=\{feature\}>✓/);
  assert.match(css, /\.unified-amenities__icon \{[^}]*display:\s*grid;[^}]*place-items:\s*center;/s);
  assert.match(css, /\.unified-amenities__icon svg \{[^}]*width:\s*21px;[^}]*height:\s*21px;/s);
});
