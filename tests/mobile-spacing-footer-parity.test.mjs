import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mobile = readFileSync(new URL("../app/mobile-polish.css", import.meta.url), "utf8");
const rail = readFileSync(new URL("../app/slider-card-compact.css", import.meta.url), "utf8");
const footer = readFileSync(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8");
const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("place photography uses the vacation 4:3 contract in every horizontal world rail", () => {
  assert.match(rail, /--place-card-media-ratio:\s*4\s*\/\s*3/);
  for (const selector of ["stay-card", "discovery-card", "event-rail-card", "spa-deal-card"]) {
    assert.match(rail, new RegExp(`${selector}[\\s\\S]*?aspect-ratio:\\s*var\\(--place-card-media-ratio\\)`));
  }
  assert.doesNotMatch(rail, /(?:stay-card__media|discovery-card__visual|event-rail-card[^}]*place-preview-card__media|spa-deal-card__image)[^{]*\{[^}]*aspect-ratio:\s*1\.85/);
});

test("events mobile sections override the late generic section padding", () => {
  assert.match(mobile, /\.events-page > \.section\s*\{\s*padding-block:24px/);
  assert.match(mobile, /\.events-page > \.event-discovery-section\s*\{\s*padding-block:14px/);
  assert.match(mobile, /\.events-page \.section-head\s*\{\s*margin-bottom:8px/);
  assert.match(mobile, /\.world-editorial \.section-head\s*\{[^}]*margin-bottom:8px/);
  assert.match(mobile, /\.world-editorial > \.home-mobile-rail-controls\s*\{\s*margin-block:0 8px/);
});

test("mobile footer has three compact disclosure groups while desktop keeps their links visible", () => {
  assert.equal((footer.match(/footerGroup\("(?:contextual|worlds|service)"/g) || []).length, 3);
  assert.match(footer, /aria-expanded=\{open\}/);
  assert.match(globals, /\.footer-group > button\s*\{/);
  assert.match(mobile, /\.footer-group > button\s*\{[^}]*min-height:52px/);
  assert.match(mobile, /\.footer-group > nav\s*\{\s*grid-template-columns:1fr/);
  assert.match(mobile, /\.footer-group:not\(\.is-open\) > nav\s*\{\s*display:none/);
  assert.doesNotMatch(mobile, /\.footer-grid nav\s*\{[^}]*grid-template-columns:repeat\(2/);
});
