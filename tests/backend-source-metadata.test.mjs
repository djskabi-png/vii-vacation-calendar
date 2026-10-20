import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { METADATA_TABLES, CATALOG_METADATA_SQL, backendSourceMetadataResponse } from '../app/lib/backend-source-metadata.ts';
import { authorizedAdminSession } from '../app/lib/admin-session.ts';
import { createSignedValue } from '../app/lib/google-auth.ts';
import { GET, POST } from '../app/api/admin/backend-readiness/route.ts';

const endpoint = 'https://vii.spaplus.co/api/admin/backend-readiness';
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE supplier_catalog_runs(id TEXT PRIMARY KEY, world TEXT, status TEXT);
    CREATE TABLE supplier_catalog_entries(id TEXT PRIMARY KEY, run_id TEXT, world TEXT, summary_json TEXT, detail_json TEXT);
    CREATE TABLE supplier_catalog_state(world TEXT PRIMARY KEY, active_run_id TEXT, active_count INTEGER, accepted_at TEXT, lock_run_id TEXT);
    CREATE TABLE vii_content_items(id TEXT PRIMARY KEY, body TEXT, editor_email TEXT);
    CREATE TABLE guest_reviews(user_email TEXT, body TEXT);
    INSERT INTO supplier_catalog_runs VALUES('run-spa','spa','accepted');
    INSERT INTO supplier_catalog_entries VALUES('e1','run-spa','spa','PRIVATE_SUMMARY','PRIVATE_DETAILS');
    INSERT INTO supplier_catalog_state VALUES('spa','run-spa',1,'2026-10-18T04:00:00Z',NULL);
    INSERT INTO vii_content_items VALUES('item','PRIVATE_DRAFT','editor@example.test');
    INSERT INTO guest_reviews VALUES('guest@example.test','PRIVATE_REVIEW');`);
  const queries = [];
  const statement = sql => ({ all: async () => { queries.push(sql); return { success: true, results: sqlite.prepare(sql).all() }; } });
  const db = { prepare: statement, batch: async statements => Promise.all(statements.map(s => s.all())) };
  return { sqlite, db, queries };
}
const deps = db => ({ authorized: async () => true, database: async () => db });

test('one real SQLite catalog statement returns counts and generation integrity, with no payload reads/writes', async () => {
  const f = fixture();
  try {
    const before = f.sqlite.prepare('SELECT total_changes() AS count').get().count;
    const response = await backendSourceMetadataResponse(new Request(endpoint), deps(f.db));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.totals, { runs: 1, entries: 1, states: 1 });
    assert.equal(body.states[0].generationMatches, true);
    assert.equal(body.tables.find(t => t.table === 'vii_content_items').exists, true);
    assert.equal(body.tables.find(t => t.table === 'vii_content_versions').exists, false);
    assert.equal(body.fullExport, false); assert.equal(body.sourceSnapshotVerified, false);
    assert.equal(body.migrationVerified, false); assert.equal(body.fullLaunchReady, false);
    assert.equal(body.observation.catalogMetadataStatements, 1);
    assert.equal(body.observation.schemasObservedSeparately, true);
    assert.equal(body.observation.rowBodiesIncluded, false);
    assert.equal(f.queries[0], CATALOG_METADATA_SQL);
    assert.equal(f.queries.length, 3 + METADATA_TABLES.length);
    assert.equal(body.tables.find(t => t.table === 'vii_content_items').rowCount, 1);
    assert.equal(body.tables.find(t => t.table === 'vii_content_versions').rowCount, null);
    assert.equal(body.tables.find(t => t.table === 'guest_reviews').rowCount, 1);
    assert.ok(METADATA_TABLES.includes('vii_search_page_opportunities'));
    assert.ok(METADATA_TABLES.includes('vii_search_page_opportunity_versions'));
    assert.equal(body.observation.rowCountsObservedSeparately, true);
    assert.ok(f.queries.every(sql => /^(SELECT|PRAGMA)\b/i.test(sql.trim())));
    assert.ok(f.queries.every(sql => sql===CATALOG_METADATA_SQL || /^PRAGMA table_info\("[a-z_]+"\)$/.test(sql) || /^SELECT COUNT\(\*\) AS count FROM "[a-z_]+"$/.test(sql)));
    assert.ok(!JSON.stringify(body).match(/PRIVATE_|@example\.test/));
    assert.equal(f.sqlite.prepare('SELECT total_changes() AS count').get().count, before);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  } finally { f.sqlite.close(); }
});

test('count or active-run-world mismatch is reported, never masked as a verified generation', async () => {
  const f = fixture();
  try {
    f.sqlite.exec("UPDATE supplier_catalog_state SET active_count=2");
    let body = await (await backendSourceMetadataResponse(new Request(endpoint), deps(f.db))).json();
    assert.equal(body.states[0].generationMatches, false);
    f.sqlite.exec("UPDATE supplier_catalog_state SET active_count=1; UPDATE supplier_catalog_runs SET world='events'");
    body = await (await backendSourceMetadataResponse(new Request(endpoint), deps(f.db))).json();
    assert.equal(body.states[0].generationMatches, false);
  } finally { f.sqlite.close(); }
});

test('empty catalog remains explicit empty metadata, not readiness', async () => {
  const f = fixture();
  try {
    f.sqlite.exec('DELETE FROM supplier_catalog_state; DELETE FROM supplier_catalog_entries; DELETE FROM supplier_catalog_runs');
    const body = await (await backendSourceMetadataResponse(new Request(endpoint), deps(f.db))).json();
    assert.deepEqual(body.states, []); assert.deepEqual(body.totals, { runs: 0, entries: 0, states: 0 });
    assert.equal(body.fullLaunchReady, false);
  } finally { f.sqlite.close(); }
});

test('unsupported inputs, methods and cross-origin requests never touch the database', async () => {
  const dependencies = { authorized: async () => true, database: async () => { throw new Error('DB_MUST_NOT_BE_TOUCHED'); } };
  for (const [request, status] of [
    [new Request(endpoint + '?table=guest_reviews'), 400],
    [new Request(endpoint + '?sql=DELETE'), 400],
    [new Request(endpoint, { method: 'POST' }), 405],
    [new Request(endpoint, { headers: { Origin: 'https://other.example.test' } }), 403],
  ]) assert.equal((await backendSourceMetadataResponse(request, dependencies)).status, status);
});

test('database, schema and malformed-metadata failures are generic and do not retry', async () => {
  let calls = 0;
  let response = await backendSourceMetadataResponse(new Request(endpoint), { authorized: async () => true,
    database: async () => { calls++; throw new Error('PRIVATE_PASSWORD=never-return'); } });
  assert.equal(response.status, 503); assert.equal(calls, 1);
  assert.deepEqual(await response.json(), { error: 'source_metadata_unavailable' });
  const f = fixture();
  try {
    f.sqlite.exec("UPDATE supplier_catalog_state SET world='unknown-world'");
    response = await backendSourceMetadataResponse(new Request(endpoint), deps(f.db));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'source_metadata_unavailable' });
  } finally { f.sqlite.close(); }
});

test('malformed orphan run metadata cannot produce a matching empty generation', async () => {
  for (const extra of [{ activeRunWorld: 'spa', activeRunStatus: null }, { activeRunWorld: null, activeRunStatus: 'accepted' }]) {
    const db = {
      prepare: () => ({ all: async () => ({ success: true, results: [
        { kind: 'totals', world: '', data: JSON.stringify({ runs: 0, entries: 0, states: 1 }) },
        { kind: 'state', world: 'spa', data: JSON.stringify({ activeRunId: null, acceptedAt: null, activeCount: 0, activeRows: 0, locked: 0, ...extra }) },
      ] }) }),
      batch: async () => METADATA_TABLES.map(() => ({ success: true, results: [] })),
    };
    const response = await backendSourceMetadataResponse(new Request(endpoint), deps(db));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'source_metadata_unavailable' });
  }
});

test('real route rejects anonymous and spoofed identity headers before runtime database import', async () => {
  for (const request of [new Request(endpoint), new Request(endpoint, { headers: { 'oai-authenticated-user-email': 'owner@example.test', 'cf-access-authenticated-user-email': 'owner@example.test' } })]) {
    assert.equal((await GET(request)).status, 403);
  }
  assert.equal((await POST(new Request(endpoint, { method: 'POST' }))).status, 403);
});

test('existing signed-session authorization excludes visitors and expired admin cookies', async () => {
  const previous = process.env.VII_AUTH_SECRET;
  process.env.VII_AUTH_SECRET = 'synthetic-backend-metadata-test-secret-32-characters';
  try {
    const f = fixture();
    try {
      for (const [email, expiry, status] of [
        ['visitor@example.test', 60, 403], ['owner@example.test', -60, 403], ['owner@example.test', 60, 200],
      ]) {
        const token = await createSignedValue({ sub: 'synthetic', name: 'Test', email, provider: 'google', exp: Math.floor(Date.now()/1000) + expiry });
        const request = new Request(endpoint, { headers: { Cookie: `vii_session=${encodeURIComponent(token)}` } });
        const response = await backendSourceMetadataResponse(request, {
          authorized: async r => !!await authorizedAdminSession(r, ['owner@example.test']), database: async () => f.db,
        });
        assert.equal(response.status, status);
      }
    } finally { f.sqlite.close(); }
  } finally {
    if (previous === undefined) delete process.env.VII_AUTH_SECRET; else process.env.VII_AUTH_SECRET = previous;
  }
});

test('route reuses existing auth and binding without schema initialization, new config or broad SQL', () => {
  const route = readFileSync(new URL('../app/api/admin/backend-readiness/route.ts', import.meta.url), 'utf8');
  assert.match(route, /authorizedAdminSession/);
  assert.match(route, /requiredRuntimeDatabase/);
  assert.doesNotMatch(route, /ensure|CREATE|ALTER|INSERT|UPDATE|DELETE|process\.env|GetSecret|Bearer/);
  assert.equal(METADATA_TABLES.length, 24);
  assert.equal(new Set(METADATA_TABLES).size,24);
  for(const table of ['guest_reviews','guest_review_files','supplier_catalog_retry_jobs','discovery_promotion_draft_events','vii_booking_audit','vii_booking_rate','vii_business_events','vii_redirect_events','vii_search_events','vii_search_demand_events','whatsapp_leads'])assert.ok(METADATA_TABLES.includes(table));
});
