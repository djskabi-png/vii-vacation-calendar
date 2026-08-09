import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("selected calendar dates keep their strong background on hover", () => {
  assert.match(css, /\.demo-day:hover:not\(:disabled\):not\(\.range-start\):not\(\.range-end\)/);
  assert.match(css, /\.demo-day\.range-start,[\s\S]*?background:\s*#27628f;[\s\S]*?color:\s*#fff/);
  assert.match(css, /\.mode-business \.demo-day\.range-start,[\s\S]*?background:\s*#9b3f00;/);
});

test("unavailable calendar dates retain readable contrast", () => {
  assert.match(css, /\.demo-day\.state-past\s*\{[^}]*background:\s*#f3f6f7;[^}]*color:\s*#5b6b6f;/);
  assert.match(css, /\.demo-day\.state-busy\s*\{[^}]*background:\s*#e8edef;[^}]*color:\s*#53666b;/);
});
