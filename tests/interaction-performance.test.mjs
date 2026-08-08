import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const localeSource = await readFile(new URL("../app/i18n/locale-provider.tsx", import.meta.url), "utf8");
const feedbackSource = await readFile(new URL("../app/components/global-action-feedback.tsx", import.meta.url), "utf8");

test("Hebrew routes do not install the translation mutation observer", () => {
  assert.match(localeSource, /if \(language === "he"\) return;/);
  assert.match(localeSource, /if \(language !== "he"\) applyLanguageToRoot\(document\.body, language\);/);
});

test("dynamic translation is scoped to changed roots instead of rescanning the document", () => {
  assert.match(localeSource, /const pendingRoots = new Set<Node>\(\);/);
  assert.match(localeSource, /pendingRoots\.forEach\(\(root\) =>/);
  assert.doesNotMatch(localeSource, /new MutationObserver\(\(\) => \{[\s\S]*?applyLanguage\(language\)/);
});

test("interaction feedback never forces synchronous layout", () => {
  assert.doesNotMatch(feedbackSource, /offsetWidth|offsetHeight|getBoundingClientRect/);
  assert.match(feedbackSource, /requestAnimationFrame/);
});

test("localized internal links keep client-side navigation", () => {
  assert.match(localeSource, /preserveLanguageOnInternalNavigation/);
  assert.match(localeSource, /anchor\.setAttribute\("href", destination\)/);
  assert.doesNotMatch(localeSource, /event\.preventDefault\(\);[\s\S]{0,300}window\.location\.assign\(destination\)/);
});
