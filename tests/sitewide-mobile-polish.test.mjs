import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../app/mobile-polish.css", import.meta.url), "utf8");
const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
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

test("floating actions work on desktop and mobile and yield to critical sections and overlays", () => {
  for (const target of ["#event-booking", "#booking-summary", "#hourly-contact"]) assert.ok(floating.includes(target));
  for (const unrelatedLargeSection of ["#hourly-options", "#reviews", ".site-footer"]) assert.ok(!floating.includes(unrelatedLargeSection));
  assert.match(floating, /observer\.disconnect\(\)/);
  assert.match(floating, /const blocked = intersections\.size > 0/);
  assert.match(floating, /setVisible\(!blocked\)/);
  assert.doesNotMatch(floating, /window\.scrollY > 450/);
  assert.doesNotMatch(floating, /\.property-booking/);
  assert.match(guard, /data-public-footer-visible/);
  assert.match(css, /body\[data-public-footer-visible\] :is\(\.mobile-map-fab,\.floating-contact-actions\)/);
  assert.match(globals, /\.floating-contact-actions\s*\{[\s\S]*?display:\s*flex;/);
  assert.match(globals, /@media \(max-width: 767px\)[\s\S]*?\.floating-contact-actions\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(globals, /width:\s*min\(calc\(100vw - 24px\),420px\)/);
  assert.match(globals, /bottom:\s*max\(12px,env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(globals, /\.floating-contact-actions > button,[\s\S]*?white-space:\s*normal;/);
  assert.match(globals, /\.floating-contact-actions > :is\(button,a\) > span\s*\{[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?text-wrap:\s*balance;/);
  assert.match(globals, /\.floating-contact-actions > :only-child\s*\{\s*grid-column:\s*1 \/ -1;/);
  assert.match(globals, /\.whatsapp-lead-layer[^)]*\) \.floating-contact-actions/);
  assert.match(css, /\.site-page > \.back-to-top\s*\{ position:static/);
});
