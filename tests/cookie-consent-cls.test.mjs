import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const consent = await readFile(new URL("../app/components/cookie-consent.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/app-experience.css", import.meta.url), "utf8");

test("first visit keeps the consent notice in SSR while saved choice hides it before paint", () => {
  assert.match(consent, /useState\(true\)/);
  assert.match(layout, /vii-cookie-choice/);
  assert.match(layout, /dataset\.viiCookieChoice='saved'/);
  assert.match(css, /\[data-vii-cookie-choice="saved"\] \.cookie-card--notice \{ display: none; \}/);
});

test("saved-choice bootstrap is storage-safe and settings remain reopenable", () => {
  assert.match(layout, /try\{if\(localStorage\.getItem\('vii-cookie-choice'\)\)/);
  assert.match(layout, /catch\(_\)\{\}/);
  assert.match(css, /cookie-card--notice/);
  assert.doesNotMatch(css, /data-vii-cookie-choice="saved"[^}]*cookie-card--settings/);
  assert.match(consent, /OPEN_EVENT/);
});
