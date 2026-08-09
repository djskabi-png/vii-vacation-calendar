import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("mobile guest selection flows directly below its summary without duplicate actions", () => {
  assert.match(css, /\.search-box-shell\.mobile-expanded \.search-step--guests \.search-popover\s*\{[^}]*position:\s*static;[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/);
  assert.match(css, /\.search-box-shell\.mobile-expanded \.vacation-party-picker \.popover-done\s*\{\s*display:\s*none;/);
  assert.match(css, /\.search-box-shell\.mobile-expanded \.search-submit\s*\{[^}]*position:\s*fixed;/);
});
