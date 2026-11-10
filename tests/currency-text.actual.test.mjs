import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
import { currencyLabelParts } from '../app/lib/currency-label.ts';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../app/components/currency-text.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

function component() {
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => name === 'react/jsx-runtime' ? require(name) : name === '../lib/currency-label' ? { currencyLabelParts } : require(name),
    console,
  });
  return module.exports.CurrencyText;
}

test('currency parser normalizes supplier prefixes and suffixes without changing amount text', () => {
  const cases = [
    ['₪ 1,250.50', '1,250.50'],
    ['מחיר 1\u202f250 ₪', '1\u202f250'],
    ['עלות: -0 ש"ח', '-0'],
    ['₪+12.25 ועוד 300 ש״ח', '+12.25'],
    ['-₪150', '-150'],
    ['₪-150', '-150'],
    ['-150 ₪', '-150'],
    ['מחיר 1\u202f250,50 ₪', '1\u202f250,50'],
    ['₪ 0', '0'],
  ];
  for (const [input, expected] of cases) {
    const matched = currencyLabelParts(input).filter(part => part.amount !== undefined);
    assert.ok(matched.length, `expected a money token in ${input}`);
    assert.equal(matched[0].amount, expected);
    assert.equal(matched[0].text, `₪\u00a0${expected}`);
  }
  const multiple = currencyLabelParts('₪10 וגם 20 ₪').filter(part => part.amount !== undefined);
  assert.deepEqual(multiple.map(part => part.amount), ['10', '20']);
  assert.equal(currencyLabelParts('יום 19-21, 45 דקות').some(part => part.amount !== undefined), false, 'dates and durations must not become money');
});

test('CurrencyText SSR emits isolated symbol-before-number markup for every matched amount', () => {
  const CurrencyText = component();
  const html = renderToStaticMarkup(React.createElement(CurrencyText, { text: 'מחיר 1,250.50 ₪, ועוד 20 ש"ח' }));
  assert.equal((html.match(/<bdi\b/g) || []).length, 2);
  assert.equal((html.match(/dir="ltr"/g) || []).length, 2);
  assert.equal((html.match(/data-currency-symbol/g) || []).length, 2);
  assert.equal((html.match(/data-currency-number/g) || []).length, 2);
  assert.match(html, /data-currency-symbol="">₪<\/span>[\s\S]*data-currency-number="">1,250\.50/);
  assert.match(html, /data-currency-symbol="">₪<\/span>[\s\S]*data-currency-number="">20/);
  assert.match(html, /class="currency-amount"/);
});

test('CurrencyText mounted DOM preserves token boundaries and LTR isolation', async () => {
  const page = new JSDOM('<div id="root"></div>', { url: 'https://vii.test/' });
  const previous = new Map();
  for (const [key, value] of Object.entries({ window: page.window, document: page.window.document, HTMLElement: page.window.HTMLElement, Node: page.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(document.getElementById('root'));
  try {
    const CurrencyText = component();
    await act(async () => root.render(React.createElement(CurrencyText, { text: 'החל מ־₪ 850 ועד 1 250 ₪' })));
    const amounts = [...document.querySelectorAll('bdi.currency-amount')];
    assert.equal(amounts.length, 2);
    assert.deepEqual(amounts.map(node => node.querySelector('[data-currency-symbol]')?.textContent), ['₪', '₪']);
    assert.deepEqual(amounts.map(node => node.querySelector('[data-currency-number]')?.textContent), ['850', '1 250']);
    for (const node of amounts) {
      assert.equal(node.getAttribute('dir'), 'ltr');
      assert.equal(node.style.direction, 'ltr');
      assert.equal(node.style.unicodeBidi, 'isolate');
    }
  } finally {
    await act(async () => root.unmount());
    page.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
