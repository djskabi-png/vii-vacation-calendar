import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function imageFindings(source, file = 'fixture.tsx') {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const walk = (node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      if (opening.tagName.getText(ast) === 'img') {
        const names = new Set(opening.attributes.properties.filter(ts.isJsxAttribute).map((a) => a.name.text));
        const decorative = source.slice(opening.getStart(ast), opening.getEnd()).includes('data-image-role="decorative"');
        if (!names.has('alt')) findings.push(`${file}: missing alt`);
        if (!names.has('title') && !decorative) findings.push(`${file}: missing title`);
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(ast);
  return findings;
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(tsx|jsx)$/.test(path) ? [path] : [];
  });
}

function inventory(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const entries = [];
  const walk = (node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      if (opening.tagName.getText(ast) === 'img') {
        const text = opening.getText(ast);
        const attributes = Object.fromEntries(opening.attributes.properties.filter(ts.isJsxAttribute).map((a) => [a.name.text, a.initializer?.getText(ast) ?? true]));
        entries.push({ file, line: ast.getLineAndCharacterOfPosition(opening.getStart(ast)).line + 1, attributes, decorative: text.includes('data-image-role="decorative"') || text.includes('aria-hidden="true"') });
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(ast);
  return entries;
}

test('AST metadata gate detects a missing title in its negative control', () => {
  assert.deepEqual(imageFindings('<img src="/x.webp" alt="מקום" />'), ['fixture.tsx: missing title']);
  assert.deepEqual(imageFindings('<img src="/x.webp" />'), ['fixture.tsx: missing alt', 'fixture.tsx: missing title']);
  assert.deepEqual(imageFindings('<img src="/x.webp" alt="" title="" data-image-role="decorative" />'), []);
});

test('repaired shared wrappers and nonholiday callsites expose metadata or explicit decorative role', () => {
  const files = [
    'app/components/responsive-card-image.tsx',
    'app/components/discovery-thumbnail.tsx',
    'app/components/resilient-image.tsx',
    'app/components/viewport-resilient-image.tsx',
    'app/components/trail-nearby-worlds.tsx',
    'app/components/gallery-experience.tsx',
    'app/discover/place/client-page.tsx',
    'app/last-minute/page.tsx',
    'app/weekend/[period]/page.tsx',
  ];
  const findings = files.flatMap((file) => imageFindings(readFileSync(file, 'utf8'), file));
  assert.deepEqual(findings, []);
});

test('complete app JSX image inventory has metadata or an explicit decorative role', () => {
  const entries = sourceFiles(resolve('app')).flatMap((file) => inventory(readFileSync(file, 'utf8'), file));
  const violations = entries.flatMap((entry) => [
    !('alt' in entry.attributes) ? `${entry.file}:${entry.line} missing alt` : null,
    !('title' in entry.attributes) && !entry.decorative ? `${entry.file}:${entry.line} missing title` : null,
    !entry.decorative && /^['"]\s*['"]$/.test(String(entry.attributes.alt ?? '')) ? `${entry.file}:${entry.line} empty informative alt` : null,
    !entry.decorative && /^['"]\s*['"]$/.test(String(entry.attributes.title ?? '')) ? `${entry.file}:${entry.line} empty informative title` : null,
  ].filter(Boolean));
  mkdirSync(resolve('.qa-output/qa847-holidays-image-metadata'), { recursive: true });
  writeFileSync(resolve('.qa-output/qa847-holidays-image-metadata/image-inventory.json'), JSON.stringify({ total: entries.length, violations, entries }, null, 2));
  assert.deepEqual(violations, []);
});
