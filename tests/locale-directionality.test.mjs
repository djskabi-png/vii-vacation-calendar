import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const provider = readFileSync(new URL("../app/i18n/locale-provider.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("only Hebrew routes use RTL at bootstrap and after hydration", () => {
  assert.match(layout, /d\.dir=l==='he'\?'rtl':'ltr'/);
  assert.match(provider, /document\.documentElement\.dir = language === "he" \? "rtl" : "ltr"/);
});

test("all non-Hebrew interfaces have an explicit LTR layout contract", () => {
  for (const locale of ["en", "ru", "fr"]) {
    assert.ok(css.includes(`html[data-locale="${locale}"] body`));
    assert.match(css, new RegExp(`html\\[data-locale="${locale}"\\] body \\*:not\\(\\[dir="rtl"\\]\\)`));
  }
  assert.match(css, /html\[data-locale="fr"\] body \{\s*direction: ltr;\s*text-align: start;/);
  assert.match(css, /:where\(h1, h2, h3, h4, h5, h6, p, li, dt, dd, label, legend, summary, input, textarea, select, button, a\)[\s\S]*?text-align: start;/);
});

test("locale bootstrapping cannot leave a restored mobile tab blank", () => {
  assert.doesNotMatch(layout, /style\.visibility='hidden'/);
  assert.doesNotMatch(layout, /data-locale-pending[^']*true|localePending='true'/);
  assert.doesNotMatch(layout, /setTimeout\(reveal/);
  assert.doesNotMatch(css, /html\[data-locale-pending="true"\] body/);
  assert.doesNotMatch(css, /locale-pending-failsafe/);
  assert.match(layout, /d\.removeAttribute\('data-locale-pending'\)/);
});
