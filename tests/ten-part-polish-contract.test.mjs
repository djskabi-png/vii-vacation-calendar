import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [events, booking, business, styles, notFound] = await Promise.all([
  readFile(new URL("../app/events/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/booking/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/not-found.tsx", import.meta.url), "utf8"),
]);

test("events first paint is translated on the server and keeps locale in discovery links", () => {
  assert.match(events, /serverPublicCopy\(\)/);
  assert.match(events, /title: translate\(sourcePresentation\.title\)/);
  assert.match(events, /description: translate\(sourcePresentation\.description\)/);
  assert.match(events, /quickSearches: sourcePresentation\.quickSearches\.map/);
  assert.match(events, /localizedPath\(item\.href, language\)/);
  assert.match(events, /name: localizePlace\(place\)\.name/);
  assert.match(events, /localizedBusinessText\(place\.name, language, translate/);
});

test("context-free booking routes recover into a useful world chooser", () => {
  assert.match(booking, /if \(!params\.place\)/);
  assert.match(booking, /\["\/events\/search", "אירועים"\]/);
  assert.match(booking, /\["\/spas", "ספא"\]/);
  assert.match(booking, /localizedPath\(href, language\)/);
  assert.doesNotMatch(booking, /placeName: "הזמנה באתר"/);
});

test("room cards expose every verified amenity in a compact scrollable row without changing image proportions", () => {
  assert.match(business, /className="room-card__amenities"/);
  assert.match(business, /localizedBusinessList\(room\.features, language, translate\)/);
  assert.doesNotMatch(business, /room\.features\.slice\(/);
  assert.match(business, /<FeatureIcon label=\{feature\} className="property-highlight-icon" \/>/);
  assert.match(styles, /\.room-card__amenities \{[^}]*overflow-x: auto;[^}]*touch-action: pan-x/);
  assert.match(styles, /\.room-card__image img \{[^}]*width: 100%; height: 100%;[^}]*object-fit: cover/);
  assert.match(styles, /\.room-card__image \{[^}]*aspect-ratio: 16 \/ 10/);
});

test("404 has a dedicated noindex identity and recovery paths", () => {
  assert.match(notFound, /title: "העמוד לא נמצא"/);
  assert.match(notFound, /robots: \{ index: false, follow: true \}/);
  assert.match(notFound, /href="\/search"/);
});
