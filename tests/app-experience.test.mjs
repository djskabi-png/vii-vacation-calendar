import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the application experience layer is loaded after responsive stability styles", async () => {
  const layout = await readFile(new URL("app/layout.tsx", root), "utf8");
  const stabilityIndex = layout.indexOf('import "./mobile-stability.css"');
  const applicationIndex = layout.indexOf('import "./app-experience.css"');
  assert.ok(stabilityIndex >= 0);
  assert.ok(applicationIndex > stabilityIndex);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(layout, /appleWebApp:/);
});

test("shared application behavior protects mobile, touch and reduced motion states", async () => {
  const css = await readFile(new URL("app/app-experience.css", root), "utf8");
  assert.match(css, /\.site-page\s*\{[^}]*min-height:\s*100dvh/s);
  assert.doesNotMatch(css, /button,\s*\.button,\s*\[role="button"\]\s*\{[^}]*min-height/s);
  assert.match(css, /min-height:\s*100dvh/);
  assert.match(css, /font-family:\s*Rubik, Heebo, Assistant, Arial, sans-serif/);
  assert.match(css, /font-size:\s*16px/);
  assert.match(css, /width:\s*calc\(100% - 16px\)/);
  assert.match(css, /background:\s*#edf4f1/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /overscroll-behavior:\s*contain/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /display-mode:\s*standalone/);
});
