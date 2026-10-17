import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/site-header.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("site-header.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const elements = [];
function visit(node) { if (ts.isJsxElement(node)) elements.push(node); ts.forEachChild(node, visit); }
visit(file);
const className = (node) => node.openingElement.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.text === "className")?.initializer?.text;

test("advertising is the first hamburger row before the managed world list", () => {
  const main = elements.find(node => className(node) === "menu-panel__main");
  assert.ok(main);
  const first = main.children.find(ts.isJsxElement);
  assert.equal(first.openingElement.tagName.getText(file), "Link");
  assert.match(first.getText(file), /translate\("פרסום באתר"\)/);
  assert.match(first.getText(file), /href=\{advertiseHref\} onClick=\{closeMenu\}/);
  assert.ok(main.getText(file).indexOf('translate("פרסום באתר")') < main.getText(file).indexOf("managedNav.map"));
});

test("the original lower advertising entry stays after the worlds with the same localized destination", () => {
  const lower = elements.find(node => className(node) === "menu-panel__join");
  assert.ok(lower);
  assert.match(lower.getText(file), /פרסום והצטרפות לאתר/);
  assert.match(lower.getText(file), /href=\{advertiseHref\} onClick=\{closeMenu\}/);
  assert.ok(lower.pos > elements.find(node => className(node) === "menu-panel__main").end);
  assert.equal((source.match(/href=\{advertiseHref\}/g) || []).length, 2);
  assert.match(source, /const advertiseHref = localizedPath\("\/join#join-pricing", language\)/);
});

test("the added label has all supported foreign language variants", async () => {
  for (const lang of ["en", "ru", "fr"]) {
    const dictionary = JSON.parse(await readFile(new URL(`../app/i18n/translations.${lang}.generated.json`, import.meta.url), "utf8"));
    assert.ok(dictionary["פרסום באתר"]);
    assert.doesNotMatch(dictionary["פרסום באתר"], /[\u0590-\u05ff]/);
  }
});
