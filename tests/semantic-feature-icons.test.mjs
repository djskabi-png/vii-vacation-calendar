import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [resolver, sharedAmenities, vacation, events, discover, sleeping, verifiedSleeping, css] = await Promise.all([
  readFile(new URL("../app/components/feature-icon.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/components/unified-amenity-list.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/discover/place/client-page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/components/sleeping-arrangements.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/components/verified-sleeping-details.tsx", import.meta.url), "utf8"),
  readEffectiveWorldCss(),
]);

test("feature icon resolver always renders a vector icon and protects the Hebrew sea token boundary", () => {
  assert.match(resolver, /return "fallback";/);
  assert.match(resolver, /data-feature-icon=\{kind\}/);
  assert.match(resolver, /\(\?:\^\|\[\\s,\.\/-\]\)ים\(\?:\$\|\[\\s,\.\/-\]\)/);
  assert.doesNotMatch(resolver, /\/נוף\|ים\//);
  for (const concept of ["accessibility", "pool", "bed", "wifi", "parking", "cooking", "security", "events"]) {
    assert.match(resolver, new RegExp(`return "${concept}"`));
  }
});

test("every place-detail feature family consumes the shared semantic icon", () => {
  assert.match(sharedAmenities, /<FeatureIcon label=\{item\} className="unified-amenities__icon" \/>/);
  assert.match(vacation, /<UnifiedAmenityList items=\{propertyAmenities\} \/>/);
  assert.match(events, /<UnifiedAmenityList items=\{localizedBusinessList\(eventFeatures, language, translate\)\} \/>/);
  assert.match(discover, /<FeatureIcon label=\{facility\} className="spa-facility-icon" \/>/);
  assert.match(discover, /<UnifiedAmenityList items=\{details\.amenities\} \/>/);
  assert.match(discover, /<FeatureIcon label=\{feature\} className="discovery-card__chip-icon" \/>/);
  assert.match(sleeping, /<FeatureIcon label=\{amenity\} className="sleeping-amenity-icon" \/>/);
  assert.match(verifiedSleeping, /<FeatureIcon label=\{detail\} className="sleeping-amenity-icon" \/>/);
  assert.match(css, /\.sleeping-amenity-icon svg \{ width: 14px; height: 14px; \}/);
  assert.match(css, /\.discovery-card__chip-icon \{ width: 18px; height: 18px; flex: 0 0 18px;[^}]*display: grid;[^}]*place-items: center;[^}]*overflow: hidden;/);
});
