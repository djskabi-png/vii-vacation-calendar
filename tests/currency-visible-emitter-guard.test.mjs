import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const rootPath = fileURLToPath(new URL('../app/', import.meta.url));
const read = path => readFileSync(join(rootPath, path), 'utf8');
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.tsx$/.test(entry.name) ? [path] : [];
  });
}
function insideSafeBoundary(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText() === 'CurrencyText') return true;
    if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText() === 'bdi') {
      const dir = parent.openingElement.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.text === 'dir');
      if (dir && dir.initializer?.getText().replaceAll('"', '') === 'ltr') return true;
    }
  }
  return false;
}
function scanCurrencyChildren(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  function visit(node) {
    const ariaHiddenText = ts.isJsxText(node) && ts.isJsxElement(node.parent) && node.parent.openingElement.attributes.properties.some(prop => ts.isJsxAttribute(prop) && prop.name.text === 'aria-hidden' && prop.initializer?.getText() === '"true"');
    if (ts.isJsxText(node) && !ariaHiddenText && !insideSafeBoundary(node) && /[₪]|ש["״׳']ח/.test(node.getText())) findings.push({ file, line: tree.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: node.getText() });
    if (ts.isJsxExpression(node) && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) && !insideSafeBoundary(node)) {
      const ariaHidden = ts.isJsxElement(node.parent) && node.parent.openingElement.attributes.properties.some(prop => ts.isJsxAttribute(prop) && prop.name.text === 'aria-hidden' && prop.initializer?.getText() === '"true"');
      if (!ariaHidden) {
        const walkExpression = child => {
          if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) return;
          if ((ts.isStringLiteralLike(child) || ts.isTemplateLiteral(child) || ts.isJsxText(child)) && /[₪]|ש["״׳']ח/.test(child.getText())) findings.push({ file, line: tree.getLineAndCharacterOfPosition(child.getStart()).line + 1, text: child.getText() });
          ts.forEachChild(child, walkExpression);
        };
        ts.forEachChild(node.expression, walkExpression);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return findings;
}

test('SPA detail package price is routed through the shared currency renderer', () => {
  const source = read('discover/place/client-page.tsx');
  assert.match(source, /<CurrencyText\s+text=\{pack\.price\}/);
  assert.doesNotMatch(source, /<strong>\{pack\.price\}<\/strong>/);
});
test('shared currency renderer owns the direction and machine-readable spans', () => {
  const source = read('components/currency-text.tsx');
  assert.match(source, /<bdi\b/);
  assert.match(source, /dir="ltr"/);
  assert.match(source, /data-currency-symbol/);
  assert.match(source, /data-currency-number/);
});
test('AST guard detects raw visible currency children but ignores safe boundaries and metadata', () => {
  const bad = '<strong>{`₪ ${price}`}</strong><span>{price} ₪</span><p>מחיר 20 ש"ח</p>';
  const safe = '<bdi dir="ltr">₪&nbsp;{price}</bdi><CurrencyText text={label}/><span aria-label={`מחיר ₪ ${price}`}>{label}</span>';
  assert.equal(scanCurrencyChildren(bad, 'negative.tsx').length, 2);
  assert.equal(scanCurrencyChildren(safe, 'safe.tsx').length, 0);
  assert.equal(scanCurrencyChildren('<>{price > 0 ? `₪ ${price}` : ""}</>', 'conditional.tsx').length, 1);
  assert.equal(scanCurrencyChildren('<>{show ? <bdi dir="ltr">₪&nbsp;{price}</bdi> : "₪10"}</>', 'mixed.tsx').length, 1);
});
test('sitewide AST guard has no unprotected visible currency children', () => {
  const findings = files(rootPath).flatMap(file => scanCurrencyChildren(readFileSync(file, 'utf8'), file));
  assert.deepEqual(findings, [], `unprotected visible currency emitters:\n${findings.map(item => `${relative(rootPath, item.file)}:${item.line} ${item.text}`).join('\n')}`);
});
test('known dynamic price sinks have an explicit visual currency boundary', () => {
  const sinks = [
    ['discover/place/client-page.tsx', /pack\.price/],
    ['booking/client-page.tsx', /props\.price/],
  ];
  for (const [file, needle] of sinks) {
    const source = read(file);
    const lines = source.split(/\r?\n/).filter(line => needle.test(line) && !/meta=\{props\.price\}/.test(line));
    assert.ok(lines.length, `${file} sink is missing`);
    assert.ok(lines.every(line => /CurrencyText|<bdi[^>]+dir=["']ltr/.test(line)), `${file} has a dynamic price without a boundary`);
  }
});

test('indirect booking and search surfaces keep money inside the shared boundary', () => {
  const account = read('account/page.tsx');
  assert.match(account, /<CurrencyText\s+text=\{booking\.offerName\}/);
  const booking = read('booking/client-page.tsx');
  assert.match(booking, /<CurrencyText\s+text=\{props\.offerName\}/);
  assert.match(booking, /<CurrencyText\s+text=\{props\.cancellationTerms\}/);
  const searchAfter = read('components/search-after-results.tsx');
  assert.equal((searchAfter.match(/<CurrencyText\s+text=\{item\.label\}/g) || []).length, 2, 'both SearchAfterResults rails must isolate item.label');
  assert.match(searchAfter, /<CurrencyText\s+text=\{item\.meta\}/);
});
