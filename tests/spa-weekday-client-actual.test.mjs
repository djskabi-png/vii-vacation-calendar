import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { orderDiscoveryItems, orderDiscoveryRail } from "../app/lib/discovery-slider-order.ts";
import { spaWeekdayPath, spaWeekdaySlugs } from "../app/lib/spa-weekday-pages.ts";

const source = fs.readFileSync(new URL("../app/components/spa-package-deals.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("spa-package-deals.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function actualFunction(name, ctx) {
  let found;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node; ts.forEachChild(node, visit); }
  visit(ast); assert.ok(found, name);
  const code = ts.transpileModule(found.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function("ctx", `with(ctx){${code};return ${name};}`)(ctx);
}
function actualOffers(layout) {
  let declaration;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "offers") declaration = node; ts.forEachChild(node, visit); }
  visit(ast); assert.ok(declaration);
  const code = ts.transpileModule(`const offers = ${declaration.initializer.getText(ast)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const dataOffers = Array.from({ length: 35 }, (_, i) => ({ siteId: i + 1, packageId: `p-${i + 1}`, price: i + 1 }));
  return new Function("ctx", `with(ctx){${code};return offers;}`)({ data: { offers: { "2026-11-06": { single: dataOffers } } }, date: "2026-11-06", audience: "single", layout, documentSeed: "fixture", orderDiscoveryItems, orderDiscoveryRail });
}
test("actual component initializer renders all grid offers but keeps rail bounded", () => {
  const grid = actualOffers("grid"); const rail = actualOffers("rail");
  assert.equal(grid.length, 35); assert.equal(rail.length, 20); assert.deepEqual(rail, grid.slice(0, 20));
});
test("actual nested select preserves same-weekday state and routes across weekdays", () => {
  const calls = []; let selected;
  const base = { setAudience: value => { selected = value; }, fixedDateOffset: undefined, scope: null, language: "he", spaWeekdaySlugs, spaWeekdayPath, localizedPath: value => value, pathname: "/spas/day/friday", params: new URLSearchParams("spaDealFor=single"), window: { history: { pushState: (...args) => calls.push(["history", ...args]) } }, router: { push: value => calls.push(["push", value]) }, sectionId: "fixture" };
  actualFunction("select", base)("2026-11-06", "couple"); assert.equal(selected, "couple"); assert.equal(calls[0][0], "history"); assert.match(calls[0][3], /spaDealFor=couple/);
  calls.length = 0; actualFunction("select", { ...base, params: new URLSearchParams() })("2026-11-07", "group"); assert.equal(calls[0][0], "push"); assert.equal(calls[0][1], "/spas/day/saturday?spaDealFor=group");
});
