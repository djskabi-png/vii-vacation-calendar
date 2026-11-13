import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../app/guides/article/client-page.tsx", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const mobileCss = readFileSync(new URL("../app/mobile-polish.css", import.meta.url), "utf8");

test("article exposes an updating progressbar and keeps desktop progress sticky", () => {
  assert.match(component, /role="progressbar"/);
  assert.match(component, /aria-valuenow=\{Math\.round\(progress\)\}/);
  assert.match(component, /<strong>\{Math\.round\(progress\)\}%<\/strong>/);
  assert.match(globalCss, /\.article-toc \{ position: sticky;/);
  assert.match(globalCss, /\.reading-progress \{ position: fixed;/);
});

test("mobile percentage is fixed in the safe area and is not visually clipped", () => {
  const ruleStart = mobileCss.indexOf(".site-page .mobile-reading-progress {");
  const ruleEnd = mobileCss.indexOf("}", ruleStart);
  const rule = mobileCss.slice(ruleStart, ruleEnd + 1);
  assert.ok(ruleStart >= 0);
  assert.match(rule, /position:fixed/);
  assert.match(rule, /env\(safe-area-inset-top\)/);
  assert.match(rule, /clip-path:none/);
  assert.doesNotMatch(rule, /width:1px/);
  assert.doesNotMatch(rule, /position:absolute/);
  assert.match(mobileCss, /\.site-page \.mobile-reading-progress\.is-visible \{ opacity:1; transform:translateY\(0\); \}/);
});
