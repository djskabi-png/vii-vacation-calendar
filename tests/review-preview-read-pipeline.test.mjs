import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { readSupplierCatalogDetailSnapshot, readSupplierCatalogReviewDetails, readSupplierCatalogReviewPreviews } from '../app/lib/supplier-catalog-store.ts';

function fixture() {
  const sql = new DatabaseSync(':memory:'); let statements = 0; let afterRead;
  sql.exec(`CREATE TABLE supplier_catalog_state(world TEXT PRIMARY KEY, active_run_id TEXT, active_count INTEGER, accepted_at TEXT);
    CREATE TABLE supplier_catalog_entries(run_id TEXT, world TEXT, supplier_id INTEGER, summary_json TEXT, detail_json TEXT,
      PRIMARY KEY(run_id, world, supplier_id));`);
  const db = { prepare(query) { statements++; let bindings = []; return {
    bind(...values) { bindings = values; return this; },
    async first() { const row = sql.prepare(query).get(...bindings) || null; afterRead?.(); return row; },
    async all() { const rows = sql.prepare(query).all(...bindings); afterRead?.(); return { results: rows }; }
  }; } };
  return { sql, db, get statements() { return statements; }, set afterRead(value) { afterRead = value; },
    state(world = 'vacations', run = 'accepted') { sql.prepare('INSERT OR REPLACE INTO supplier_catalog_state VALUES(?,?,?,?)').run(world, run, 1, 'today'); },
    put(id, detail, run = 'accepted', world = 'vacations') { sql.prepare('INSERT INTO supplier_catalog_entries VALUES(?,?,?,?,?)').run(run, world, id, '{}', detail === null ? null : JSON.stringify(detail)); } };
}
const valid = (text) => ({ text, author: 'public guest', date: '2026-10-01' });
const qualifying = (reviews) => reviews.find((entry) => entry && typeof entry.text === 'string' && entry.text.trim().length >= 30);

test('detail snapshot reads full accepted detail and generation existence atomically with one query', async () => {
  const f = fixture();
  try {
    assert.equal(await readSupplierCatalogDetailSnapshot(f.db, 'vacations', 1), null);
    f.state('vacations', null);
    assert.deepEqual(await readSupplierCatalogDetailSnapshot(f.db, 'vacations', 1), { activeRunId: null, detail: null });
    f.state(); f.put(1, { title: 'same detail', rooms: [1, 2], reviews: [valid('x'.repeat(40))] });
    let start = f.statements;
    assert.deepEqual((await readSupplierCatalogDetailSnapshot(f.db, 'vacations', 1)).detail,
      { title: 'same detail', rooms: [1, 2], reviews: [valid('x'.repeat(40))] });
    assert.equal(f.statements - start, 1);
    assert.deepEqual(await readSupplierCatalogDetailSnapshot(f.db, 'vacations', 2), { activeRunId: 'accepted', detail: null });
    f.state('events', 'events-run'); f.put(1, { title: 'event only' }, 'events-run', 'events');
    assert.equal((await readSupplierCatalogDetailSnapshot(f.db, 'events', 1)).detail.title, 'event only');
    start = f.statements;
    for (const id of [NaN, -1, 0, 1.5]) assert.equal(await readSupplierCatalogDetailSnapshot(f.db, 'vacations', id), null);
    assert.equal(f.statements, start);
  } finally { f.sql.close(); }
});

test('real review previews preserve exact first usable review with substantially less transfer', async () => {
  const f = fixture();
  try {
    const data = JSON.parse(await readFile(new URL('../app/data/sergey-place-details.json', import.meta.url), 'utf8'));
    const entries = Object.entries(data.details).filter(([id, detail]) => id.startsWith('vacation-') && detail.reviews?.length).slice(0, 14);
    f.state();
    for (const [key, detail] of entries) f.put(Number(key.slice(9)), detail);
    const ids = entries.map(([key]) => Number(key.slice(9)));
    const original = await readSupplierCatalogReviewDetails(f.db, 'vacations', ids);
    const started = f.statements;
    const snapshot = await readSupplierCatalogReviewPreviews(f.db, 'vacations', [...ids, ids[0], 0, NaN]);
    for (const id of ids) assert.deepEqual(snapshot.previews.get(id).reviews, qualifying(original.get(id).reviews) ? [qualifying(original.get(id).reviews)] : []);
    const before = Buffer.byteLength(JSON.stringify([...original]));
    const after = Buffer.byteLength(JSON.stringify([...snapshot.previews]));
    assert.ok(after < before * .2, `${before} -> ${after}`);
    assert.equal(f.statements - started, 1);
    console.log(JSON.stringify({ realReviewPreviewBytes: { before, after, reductionPercent: Math.round((1 - after / before) * 100) }, queries: 1 }));
  } finally { f.sql.close(); }
});

test('conservative candidates preserve JS trim and UTF16 semantics, array order and malformed members', async () => {
  const f = fixture();
  try {
    f.state();
    const groups = [
      [valid('short'), valid('a'.repeat(30)), valid('later'.repeat(20))],
      [valid(' '.repeat(40)), valid('valid second'.repeat(4))],
      [valid('\u00a0'.repeat(35)), valid('trim valid'.repeat(4))],
      [valid('😀'.repeat(8)), valid('later valid'.repeat(4))],
      [valid('😀'.repeat(15)), valid('later valid'.repeat(4))],
      [valid('\u200b'.repeat(30)), valid('later valid'.repeat(4))],
      [null, 17, 'not object', { text: 45 }, valid('real'.repeat(10))],
      [valid(' \ufeff\u202f'.repeat(20)), valid('good'.repeat(10))],
      [valid('short'), valid('')], []
    ];
    groups.forEach((reviews, i) => f.put(i + 1, { reviews }));
    const snapshot = await readSupplierCatalogReviewPreviews(f.db, 'vacations', groups.map((_, i) => i + 1));
    groups.forEach((reviews, i) => assert.deepEqual(snapshot.previews.get(i + 1).reviews,
      qualifying(reviews) ? [qualifying(reviews)] : [], `group ${i}`));
    assert.equal(f.statements, 2, 'ambiguous candidates share one bounded fallback query');
  } finally { f.sql.close(); }
});

test('preview fallbacks pin generation across publication and never resurrect missing accepted entities', async () => {
  const f = fixture();
  try {
    assert.equal(await readSupplierCatalogReviewPreviews(f.db, 'vacations', [1]), null);
    f.state(); f.put(1, { reviews: [valid(' '.repeat(40)), valid('old valid'.repeat(5))] });
    f.put(1, { reviews: [valid('new valid'.repeat(5))] }, 'new');
    let reads = 0; f.afterRead = () => { if (++reads === 1) f.state('vacations', 'new'); };
    const snapshot = await readSupplierCatalogReviewPreviews(f.db, 'vacations', [1, 999]);
    assert.equal(snapshot.activeRunId, 'accepted');
    assert.equal(snapshot.previews.get(1).reviews[0].text, 'old valid'.repeat(5));
    assert.equal(snapshot.previews.has(999), false);
    f.afterRead = undefined;
    assert.equal((await readSupplierCatalogReviewPreviews(f.db, 'vacations', [999])).activeRunId, 'new');
    assert.equal((await readSupplierCatalogReviewPreviews(f.db, 'vacations', [999])).previews.size, 0);
    const start = f.statements;
    assert.equal(await readSupplierCatalogReviewPreviews(f.db, 'vacations', []), null);
    assert.equal(f.statements, start);
  } finally { f.sql.close(); }
});

test('public detail wrapper permits bundled fallback only before first accepted generation', async () => {
  const source = stripTypeScriptTypes((await readFile(new URL('../app/lib/public-catalog-read.ts', import.meta.url), 'utf8')).replace(/^import .*;\r?$/gm, ''));
  let entry; let activeRunId = null; let entryReads = 0; let stateReads = 0;
  const readDetail = new Function('sergeyDetails', 'runtimeCatalogDatabase', 'readSupplierCatalogEntry', 'readSupplierCatalogState',
    source.replace(/export /g, '') + '; return publicCatalogDetail;')(
      { details: { 'vacation-1': { name: 'bundled' } } }, async () => ({}),
      async () => { entryReads++; return entry; }, async () => { stateReads++; return activeRunId ? { activeRunId } : null; });
  assert.deepEqual(await readDetail('vacations', 1), { name: 'bundled' });
  activeRunId = 'live';
  assert.equal(await readDetail('vacations', 1), null);
  entry = { detail: { name: 'live', rooms: [{ id: 39, name: 'צימר 1', images: ['/api/vii/media/unit-39.jpg'] }] } };
  assert.deepEqual(await readDetail('vacations', 1), {
    name: 'live', images: [], rooms: [{ id: 39, name: 'צימר 1', images: ['/api/vii/media/unit-39.jpg'] }],
  });
  assert.equal(entryReads, 3, 'the accepted entry is the first read on every call');
  assert.equal(stateReads, 2, 'state is read only when the supplier entry is absent');
});

test('all bundled vacation and event review selections keep exact parity in D1-sized batches', async () => {
  const f = fixture();
  try {
    const data = JSON.parse(await readFile(new URL('../app/data/sergey-place-details.json', import.meta.url), 'utf8'));
    for (const [world, prefix] of [['vacations', 'vacation-'], ['events', 'event-']]) {
      f.state(world, world);
      const entries = Object.entries(data.details).filter(([key]) => key.startsWith(prefix));
      for (const [key, detail] of entries) f.put(Number(key.slice(prefix.length)), detail, world, world);
      for (let i = 0; i < entries.length; i += 60) {
        const batch = entries.slice(i, i + 60);
        const snapshot = await readSupplierCatalogReviewPreviews(f.db, world, batch.map(([key]) => Number(key.slice(prefix.length))));
        for (const [key, detail] of batch) {
          const expected = qualifying(detail.reviews || []);
          assert.deepEqual(snapshot.previews.get(Number(key.slice(prefix.length))).reviews, expected ? [expected] : [], key);
        }
      }
    }
  } finally { f.sql.close(); }
});

test('public review wrapper never revives old bundled reviews for accepted missing entries', async () => {
  const source = stripTypeScriptTypes((await readFile(new URL('../app/lib/public-catalog-read.ts', import.meta.url), 'utf8')).replace(/^import .*;\r?$/gm, ''));
  let snapshot; let reads = 0;
  const review = valid('bundled review'.repeat(4));
  const readPreview = new Function('sergeyDetails', 'runtimeCatalogDatabase', 'readSupplierCatalogReviewPreviews',
    source.replace(/export /g, '') + '; return publicCatalogReviewPreviews;')(
      { details: { 'vacation-1': { reviews: [valid('short'), review] } } }, async () => ({}), async () => { reads++; return snapshot; });
  assert.deepEqual((await readPreview('vacations', [1])).get(1), { reviews: [review] });
  snapshot = { activeRunId: 'accepted', previews: new Map() };
  assert.equal((await readPreview('vacations', [1])).get(1), null);
  await readPreview('vacations', []);
  assert.equal(reads, 2);
});
