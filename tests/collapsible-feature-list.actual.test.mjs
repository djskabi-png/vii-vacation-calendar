import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

const source = fs.readFileSync(new URL('../app/components/collapsible-feature-list.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function load(react) {
  const module = { exports: {} };
  Function('require', 'module', 'exports', js)(name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return jsx;
    if (name === '../i18n/locale-provider') return { useSiteLanguage: () => ({ translate: value => value }) };
    throw Error('Unexpected dependency: ' + name);
  }, module, module.exports);
  return module.exports.CollapsibleFeatureList;
}
const items = count => Array.from({ length: count }, (_, i) => React.createElement('span', { key: i, 'data-feature-id': i }, `Feature ${i}`));

test('actual disclosure preserves all items through expand, collapse and short/empty lists', () => {
  let expanded = false;
  const Component = load({ useId: () => 'feature-list-fixture', useState: () => [expanded, update => { expanded = update(expanded); }], useEffect: () => undefined });
  for (const count of [0, 1, 8, 9, 16]) {
    expanded = false;
    const children = items(count);
    const render = () => Component({ children, className: 'feature-list' });
    let tree = render();
    assert.equal(tree.props.children[0].props.children.length, Math.min(8, count));
    const button = tree.props.children[1];
    assert.equal(Boolean(button), count > 8);
    if (!button) continue;
    assert.equal(button.props['aria-expanded'], false);
    assert.equal(button.props['aria-controls'], tree.props.children[0].props.id);
    button.props.onClick();
    tree = render();
    assert.deepEqual(tree.props.children[0].props.children, children);
    assert.equal(tree.props.children[1].props['aria-expanded'], true);
    tree.props.children[1].props.onClick();
    assert.equal(render().props.children[0].props.children.length, 8);
    assert.equal(children.length, count, 'source inventory was never mutated');
  }
});

test('actual SSR gives adjacent feature groups distinct disclosure relationships', () => {
  const Component = load(React);
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(Component, { className: 'feature-list' }, items(12)),
    React.createElement(Component, { className: 'hourly-feature-grid' }, items(16))));
  const ids = [...html.matchAll(/aria-controls="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
  assert.ok(ids.every(id => html.includes(`id="${id}"`)));
  assert.equal([...html.matchAll(/data-feature-id=/g)].length, 16);
});
