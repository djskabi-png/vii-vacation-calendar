import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
import * as content from '../app/lib/content-studio.ts';
import * as faq from '../app/lib/world-landing-faq.ts';
import * as media from '../app/lib/world-topic-media.ts';

const source = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function presentation(db) {
  const module = { exports: {} };
  const code = ts.transpileModule(source('app/lib/world-landing-presentation.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  Function('require', 'module', 'exports', code)(name => {
    if (name === './content-studio.ts') return content;
    if (name === './world-landing-faq.ts') return faq;
    if (name === './world-topic-media.ts') return media;
    if (name === './runtime-database.ts') return { runtimeDatabase: async () => db };
    throw Error('Unexpected dependency: ' + name);
  }, module, module.exports);
  return module.exports;
}

test('actual editorial normalization keeps a full FAQ payload and rejects invalid rows', () => {
  const rows = Array.from({ length: 4 }, (_, i) => ({ question: 'Question ' + i, answer: 'a'.repeat(500) }));
  const raw = JSON.stringify(rows);
  assert.ok(raw.length > 1200);
  assert.equal(content.normalizeEditorial({ title: 'Hourly', attributes: { worldFaq: raw } }).attributes.worldFaq, raw);
  for (const invalid of ['broken', JSON.stringify([...rows, ...rows, rows[0]]), '[{"question":"<script>","answer":"x"}]']) {
    assert.equal(content.normalizeEditorial({ title: 'Hourly', attributes: { worldFaq: invalid } }), null);
  }
  assert.deepEqual(faq.publicWorldLandingFaq('[{"question":" Q ","answer":" A "},{"question":"","answer":"draft"}]'), [{ question: 'Q', answer: 'A' }]);
});

test('actual world reader uses one versioned published query, retains published FAQ during draft and isolates locale', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(source('drizzle/0008_content_studio.sql'));
  let reads = 0;
  const db = { prepare(sql) { return { bind(...args) { return { async first() { reads++; return sqlite.prepare(sql).get(...args) || null; } }; } }; } };
  const row = label => content.normalizeEditorial({ title: 'Hourly', attributes: { worldFaq: JSON.stringify([{ question: label, answer: 'Answer' }]) } });
  for (const locale of ['he', 'en']) {
    const id = content.contentItemId('hourly', 'landing', locale);
    sqlite.prepare(`INSERT INTO vii_content_items (id,content_type,entity_key,world,locale,source_label,source_json,draft_json,status,version,published_version,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, 'hourly', 'landing', 'hourly', locale, 'fixture', '{}', JSON.stringify(row('Draft')), 'draft', 2, 1, '2026-01-01', 'fixture');
    for (const version of [1, 2]) sqlite.prepare(`INSERT INTO vii_content_versions VALUES (?,?,?,?,?,?,?,?,?)`).run(id + ':' + version, id, version, 'save', version === 1 ? 'published' : 'draft', JSON.stringify(row(locale + version)), null, '2026-01-01', 'fixture');
  }
  const { readWorldLandingPresentation } = presentation(db);
  assert.equal((await readWorldLandingPresentation('hourly')).faqs[0].question, 'he1');
  assert.equal(reads, 1);
  assert.equal((await readWorldLandingPresentation('hourly', 'en')).faqs[0].question, 'en1');
  assert.equal(reads, 2);
  assert.deepEqual((await readWorldLandingPresentation('hourly', 'fr')).faqs, []);
  sqlite.prepare("UPDATE vii_content_items SET status='scheduled',scheduled_at='2999-01-01' WHERE locale='he'").run();
  assert.equal((await readWorldLandingPresentation('hourly')).faqs[0].question, 'he1');
  sqlite.prepare("UPDATE vii_content_items SET scheduled_at='2000-01-01' WHERE locale='he'").run();
  assert.equal((await readWorldLandingPresentation('hourly')).faqs[0].question, 'he2');
  sqlite.close();
});

test('actual landing FAQ choice keeps route precedence, hides only duplicate FAQ and uses the existing editor', () => {
  const text = source('app/components/world-landing.tsx');
  const ast = ts.createSourceFile('landing.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'effectiveManagedFaq') initializer = node.initializer.getText(ast); ts.forEachChild(node, visit); }
  visit(ast);
  assert.ok(initializer);
  const choose = Function('managedFaq', 'world', 'managedPresentation', 'return (' + initializer + ')');
  const route = [{ question: 'Route', answer: 'A' }], world = [{ question: 'World', answer: 'B' }];
  assert.deepEqual(choose(route, 'hourly', { faqs: world }), route);
  assert.deepEqual(choose(undefined, 'hourly', { faqs: world }), world);
  assert.deepEqual(choose(undefined, 'spa', { faqs: world }), []);
  assert.match(text, /hideFaq=\{effectiveManagedFaq.length > 0\}/);
  assert.match(source('app/components/search-after-results.tsx'), /!hideGuideAndFaq && !discoveryOnly \? <section className="search-depth__guide"/);
  assert.match(source('app/admin/content-studio/page.tsx'), /WorldLandingFaqEditor value=\{draft.attributes.worldFaq/);
});
