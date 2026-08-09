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
