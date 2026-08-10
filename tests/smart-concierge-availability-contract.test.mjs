import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const pageShell = await readFile(new URL("../app/components/page-shell.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("the smart WhatsApp concierge is part of the shared public page shell", () => {
  assert.match(pageShell, /<SmartConcierge\s*\/>/);
});

test("mobile detail and corporate pages keep the concierge available", () => {
  assert.doesNotMatch(css, /body:has\(\.detail-sticky-wrap\) \.smart-concierge[^}]*display:\s*none/);
  assert.doesNotMatch(css, /body:has\(\.corporate-builder\) \.smart-concierge[^}]*display:\s*none/);
  assert.match(css, /body:has\(\.detail-sticky-wrap\) \.smart-concierge \{ bottom:\s*calc\(94px/);
});

test("the concierge only yields to active overlays that would cover it", () => {
  assert.match(css, /body:has\(\.filter-panel\.open\) \.smart-concierge/);
  assert.match(css, /body:has\(\.menu-layer\) \.smart-concierge/);
  assert.match(css, /body:has\(\.search-box-shell\.mobile-expanded\) \.smart-concierge/);
  assert.match(css, /body:has\(\.map-results-experience\) \.smart-concierge/);
});
