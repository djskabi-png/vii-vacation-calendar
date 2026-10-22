import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../app/mobile-polish.css", import.meta.url), "utf8");
const floating = fs.readFileSync(new URL("../app/components/floating-contact-actions.tsx", import.meta.url), "utf8");
const guard = fs.readFileSync(new URL("../app/components/responsive-viewport-guard.tsx", import.meta.url), "utf8");

test("mobile review rail resets explicit columns and inherited full-height stretching", () => {
  assert.match(css, /\.review-experience__published\s*\{[^}]*grid-template-columns:none;[^}]*grid-auto-columns:100%/);
  assert.match(css, /\.review-card--published\s*\{[^}]*height:auto/);
  assert.match(css, /\.review-card--expandable:not\(\.is-expanded\) \.review-card__original/);
  assert.doesNotMatch(css, /\.review-card:not\(\.is-expanded\) \.review-card__original/);
});

test("full cards and compact depth cards retain bounded rail controls", () => {
  assert.match(css, /\.home-mobile-rail > \*\s*\{[^}]*flex:0 0 100%[^}]*max-inline-size:100%/);
  assert.match(css, /\.search-depth__rail-controls\s*\{ display:flex/);
  assert.match(css, /\.search-depth__discovery-card\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\[data-slider-controls\] button\s*\{[^}]*min-width:44px[^}]*min-height:44px/);
});

test("floating actions yield to critical mobile sections without disappearing on desktop", () => {
  for (const target of ["#event-booking", "#booking-summary", "#hourly-options", "#hourly-contact", "#reviews", ".site-footer"]) assert.ok(floating.includes(target));
  assert.match(floating, /observer\.disconnect\(\)/);
  assert.match(floating, /matchMedia\("\(max-width: 767px\)"\)/);
  assert.match(floating, /const blocked = compactViewport && intersections\.size > 0/);
  assert.match(guard, /data-public-footer-visible/);
  assert.match(css, /body\[data-public-footer-visible\] :is\(\.mobile-map-fab,\.floating-contact-actions\)/);
  assert.match(css, /\.site-page > \.back-to-top\s*\{ position:static/);
});
