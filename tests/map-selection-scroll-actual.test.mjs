import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../app/components/map-split-result-list.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('map-split-result-list.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') effect = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpileModule(`const effect = ${effect.getText(ast)};`, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;

for (const reduced of [false, true]) {
  test(`actual selection effect scrolls only the result pane (reduced motion ${reduced})`, () => {
    const calls = [];
    const card = {dataset: {mapPlaceId: 'chosen'}, getBoundingClientRect: () => ({top: 1100, bottom: 1400}), scrollIntoView: () => {throw new Error('ancestor scrolling can hide the map popup');}};
    const pane = {scrollTop: 200, clientTop: 1, clientHeight: 700, getBoundingClientRect: () => ({top: 100, bottom: 802}), querySelectorAll: () => [card], scrollTo: options => calls.push(options)};
    const run = new Function('ctx', `with(ctx){${code};return effect;}`)({activeId: 'chosen', listRef: {current: pane}, window: {matchMedia: () => ({matches: reduced})}});
    run();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].top, 799);
    assert.equal(calls[0].behavior, reduced ? 'auto' : 'smooth');
    card.getBoundingClientRect = () => ({top: 150, bottom: 400});
    calls.length = 0;
    run();
    assert.equal(calls.length, 0, 'an already visible selection must not move either scroll container');
    card.getBoundingClientRect = () => ({top: 50, bottom: 350});
    run();
    assert.equal(calls[0].top, 149);
  });
}
