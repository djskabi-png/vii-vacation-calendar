import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("mobile search exposes a real current step and only submits at the final step", () => {
  assert.match(source, /className="search-mobile-progress" aria-label=\{`שלב \$\{mobileStep/);
  assert.match(source, /aria-current=\{mobileStep === "dates" \? "step"/);
  assert.doesNotMatch(css, /content:\s*"1  2  3"/);
  assert.match(css, /\.search-box-shell\.mobile-expanded \.search-submit\s*\{[^}]*display:\s*none;/);
  assert.match(css, /\.search-box-shell\.mobile-expanded \.search-box\.mobile-step-guests \.search-submit,[\s\S]*?display:\s*flex;/);
});

test("mobile spa and event guest steps stay complete and hide persistent actions", () => {
  assert.match(source, /mode === "events" \? "בונים את האירוע"/);
  assert.match(source, /mode === "spa" \? "בונים את חוויית הספא"/);
  assert.match(source, /mobileExpanded \? true : !value/);
  assert.match(source, /if \(!mobileExpanded\) setGuestOpen\(false\)/);
  assert.match(css, /\.search-box-shell\.mobile-expanded \.search-step--guests \.popover-done \{ display: none; \}/);
  assert.match(css, /body:has\(\.search-box-shell\.mobile-expanded\) \.smart-concierge/);
  assert.match(css, /body:has\(\.search-box-shell\.mobile-expanded\) \.mobile-map-fab/);
});
test("mobile search releases page scrolling as soon as the sheet closes", () => {
  assert.doesNotMatch(source, /document\.body\.style\.overflow/);
  assert.match(css, /body:has\(\.search-box-shell\.mobile-expanded\) \{ overflow: hidden; \}/);
});