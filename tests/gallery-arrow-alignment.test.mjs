import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("disabled gallery arrows preserve the component's vertical centering transform", () => {
  assert.match(globals, /button\.property-gallery__mobile-arrow[^}]+transform:\s*translateY\(-50%\)/);
  assert.match(globals, /button\[data-slider-boundary\]:disabled\s*\{[^}]+pointer-events:\s*none;/);
  assert.doesNotMatch(globals, /button\[data-slider-boundary\]:disabled\s*\{[^}]+transform:\s*none/);
});
