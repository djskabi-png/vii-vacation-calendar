import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATALOG_SNAPSHOT_SQL, catalogSnapshotResponse } from '../app/lib/catalog-snapshot.ts';
import { verifyActiveCatalogSnapshot } from '../infrastructure/postgres/catalog-snapshot-reader.mjs';
import { authorizedAdminSession } from '../app/lib/admin-session.ts';
import { createSignedValue } from '../app/lib/google-auth.ts';

const endpoint = 'https://vii.spaplus.co/api/admin/catalog-snapshot';
const worlds = ['vacations', 'events', 'rooms', 'spa'];
function fixture(file = ':memory:') {
  const sqlite = new DatabaseSync(file);
  sqlite.exec(`CREATE TABLE supplier_catalog_runs(id TEXT PRIMARY KEY,world TEXT,source TEXT,status TEXT,started_at TEXT,finished_at TEXT,before_count INTEGER,candidate_count INTEGER,added_count INTEGER,changed_count INTEGER,removed_count INTEGER,error_code TEXT,diagnostics_json TEXT);
    CREATE TABLE supplier_catalog_entries(id TEXT PRIMARY KEY,run_id TEXT,world TEXT,supplier_id INTEGER,summary_json TEXT,detail_json TEXT);
    CREATE TABLE supplier_catalog_state(world TEXT PRIMARY KEY,active_run_id TEXT,accepted_at TEXT,active_count INTEGER,lock_run_id TEXT,lock_until TEXT);
    CREATE TABLE private_customer_bookings(secret TEXT);
    INSERT INTO private_customer_bookings VALUES('DO_NOT_EXPORT');`);
  for (const world of worlds) {
    sqlite.prepare('INSERT INTO supplier_catalog_runs VALUES(?,?,?, ?,?,?,0,1,1,0,0,NULL,?)').run('run-'+world,world,'manual','accepted','2026-10-18T03:00:00Z','2026-10-18T03:01:00Z','{"unknownDiagnostic":4}');
    sqlite.prepare('INSERT INTO supplier_catalog_entries VALUES(?,?,?,?,?,?)').run('entry-'+world,'run-'+world,world,1,
      JSON.stringify({ id: 1, title: 'שלום', unknown: { price: '300.00', photos: ['a','b'], nested: [1,null,true] } }),
      JSON.stringify({ unknownDetail: { original: 'Exact\n"ביטוי"', review: 'SYNTHETIC_PRIVATE_REVIEW' } }));
    sqlite.prepare('INSERT INTO supplier_catalog_state VALUES(?,?,?,1,NULL,NULL)').run(world,'run-'+world,'2026-10-18T03:01:00Z');
  }
  // Historical raw rows intentionally excluded, even if they look publishable.
  sqlite.prepare('INSERT INTO supplier_catalog_runs VALUES(?,?,?, ?,?,?,0,1,1,0,0,NULL,NULL)').run('history','spa','manual','accepted','2026-10-17T03:00:00Z','2026-10-17T03:01:00Z');
  sqlite.prepare('INSERT INTO supplier_catalog_entries VALUES(?,?,?,?,?,NULL)').run('old','history','spa',2,'{"old":true}');
  const queries = [];
  const db = { prepare: sql => ({ all: async () => { queries.push(sql); return { success:true, results:sqlite.prepare(sql).all() }; } }) };
  return { sqlite, db, queries };
}
const deps = db => ({ authorized:async()=>true, database:async()=>db });
const exported = async f => (await catalogSnapshotResponse(new Request(endpoint),deps(f.db))).text();

test('one SQLite statement exports all4 active generations, preserves unknown payloads and changes no rows',async()=>{
  const f=fixture();
  try {
    const before=f.sqlite.prepare('SELECT total_changes() AS n').get().n;
    const response=await catalogSnapshotResponse(new Request(endpoint),deps(f.db));
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-disposition'),/attachment/);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    const text=await response.text(), result=verifyActiveCatalogSnapshot(text);
    assert.deepEqual(result.proof.counts,{run:4,entry:4,state:4});
    assert.equal(result.proof.integrityVerified,true);
    assert.equal(result.proof.sourceConsistencyVerified,false);
    assert.equal(result.proof.migrationVerified,false);
    assert.equal(result.proof.fullLaunchReady,false);
    assert.deepEqual(result.canonical.entries[0].summary_json.unknown,{price:'300.00',photos:['a','b'],nested:[1,null,true]});
    assert.match(result.canonical.entries[0].detail_json.unknownDetail.review,/SYNTHETIC_PRIVATE/);
    assert.doesNotMatch(text,/DO_NOT_EXPORT|"old"|"id":"history"/);
    assert.equal(f.queries.length,1); assert.equal(f.queries[0],CATALOG_SNAPSHOT_SQL);
    assert.doesNotMatch(CATALOG_SNAPSHOT_SQL,/\b(INSERT|UPDATE|DELETE|PRAGMA|CREATE|DROP|ALTER)\b/i);
    assert.equal(f.sqlite.prepare('SELECT total_changes() AS n').get().n,before);
  } finally {f.sqlite.close();}
});

test('truncated, tampered, duplicated, reordered and missing-footer downloads never verify',async()=>{
  const f=fixture();
  try {
    const text=await exported(f), lines=text.trimEnd().split('\n');
    for(const corrupted of [text.slice(0,-1),lines.slice(0,-1).join('\n')+'\n',text.replace('300.00','301.00'),
      [lines[0],lines[2],lines[1],...lines.slice(3)].join('\n')+'\n', [...lines.slice(0,3),lines[2],...lines.slice(3)].join('\n')+'\n'])
      assert.throws(()=>verifyActiveCatalogSnapshot(corrupted));
  } finally {f.sqlite.close();}
});

test('mismatched counts, world, locks, malformed JSON and missing generations fail closed',async()=>{
  for(const change of ["UPDATE supplier_catalog_state SET active_count=2 WHERE world='spa'",
    "UPDATE supplier_catalog_entries SET world='events' WHERE id='entry-spa'",
    "UPDATE supplier_catalog_state SET lock_until='2026-10-19T00:00:00Z' WHERE world='spa'",
    "UPDATE supplier_catalog_state SET lock_run_id='locked' WHERE world='spa'",
    "UPDATE supplier_catalog_runs SET status='failed' WHERE id='run-spa'",
    "UPDATE supplier_catalog_entries SET summary_json='BROKEN' WHERE id='entry-spa'",
    "DELETE FROM supplier_catalog_state WHERE world='spa'", "DELETE FROM supplier_catalog_state"]) {
    const f=fixture();
    try { f.sqlite.exec(change); const response=await catalogSnapshotResponse(new Request(endpoint),deps(f.db));
      assert.equal(response.status,503,change); assert.deepEqual(await response.json(),{error:'catalog_snapshot_unavailable'});
      assert.equal(f.queries.length,1);
    } finally {f.sqlite.close();}
  }
});

test('SQL guards measure UTF8 bytes and withhold all row bodies for oversized input',async()=>{
  const f=fixture();
  try {
    // One large raw field stays below provider row limit, but total >12MiB.
    const payload=JSON.stringify({large:'א'.repeat(799000)});
    f.sqlite.prepare('UPDATE supplier_catalog_entries SET detail_json=?').run(payload);
    for(let i=2;i<=3;i++) f.sqlite.prepare('INSERT INTO supplier_catalog_entries VALUES(?,?,?,?,?,?)').run('extra'+i,'run-spa','spa',i,'{}',payload);
    f.sqlite.exec("UPDATE supplier_catalog_state SET active_count=3 WHERE world='spa'");
    // Add another couple of bounded rows to cross cap without oversize rows.
    for(let i=4;i<=5;i++) f.sqlite.prepare('INSERT INTO supplier_catalog_entries VALUES(?,?,?,?,?,?)').run('extra'+i,'run-spa','spa',i,'{}',payload);
    f.sqlite.exec("UPDATE supplier_catalog_state SET active_count=5 WHERE world='spa'");
    const raw=f.sqlite.prepare(CATALOG_SNAPSHOT_SQL).all();
    assert.equal(raw.length,1); assert.equal(raw[0].kind,'control'); assert.equal(JSON.parse(raw[0].data).ok,0);
    assert.equal((await catalogSnapshotResponse(new Request(endpoint),deps(f.db))).status,503);
  } finally {f.sqlite.close();}
});

test('invalid method/query/origin/identity and database failure do not expose payloads or retry',async()=>{
  let calls=0;
  const dependency={authorized:async()=>true,database:async()=>{calls++;throw Error('SECRET_NEVER_RETURN');}};
  for(const [request,status] of [[new Request(endpoint+'?sql=SELECT'),400],[new Request(endpoint,{method:'POST'}),405],
    [new Request(endpoint,{headers:{Origin:'https://attacker.test'}}),403]])
    assert.equal((await catalogSnapshotResponse(request,dependency)).status,status);
  assert.equal(calls,0);
  const failed=await catalogSnapshotResponse(new Request(endpoint),dependency);
  assert.equal(failed.status,503); assert.equal(calls,1);
  assert.deepEqual(await failed.json(),{error:'catalog_snapshot_unavailable'});
  for(const request of [new Request(endpoint),new Request(endpoint,{headers:{'X-User-Email':'owner@example.test'}})]) {
    const response=await catalogSnapshotResponse(request,{...dependency,authorized:async()=>false});
    assert.equal(response.status,403); assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
  }
  assert.equal(calls,1);
});

test('actual signed admin, non-admin and expired sessions retain existing boundary',async()=>{
  const old=process.env.VII_AUTH_SECRET; process.env.VII_AUTH_SECRET='synthetic-snapshot-test-only-0123456789';
  const f=fixture();
  try {
    for(const [email,seconds,status] of [['visitor@example.test',60,403],['owner@example.test',-60,403],['owner@example.test',60,200]]) {
      const token=await createSignedValue({sub:'test',name:'Synthetic',email,provider:'google',exp:Math.floor(Date.now()/1000)+seconds});
      const request=new Request(endpoint,{headers:{Cookie:`vii_admin_session=${encodeURIComponent(token)}`}});
      const response=await catalogSnapshotResponse(request,{authorized:async r=>!!await authorizedAdminSession(r,['owner@example.test']),database:async()=>f.db});
      assert.equal(response.status,status);
      if(status===200) verifyActiveCatalogSnapshot(await response.text());
    }
  } finally {f.sqlite.close();if(old===undefined) delete process.env.VII_AUTH_SECRET; else process.env.VII_AUTH_SECRET=old;}
});

test('single read snapshot is not mixed when another WAL connection changes active generation mid-statement',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'vii-catalog-snapshot-'));
  let f, writer;
  try {
    const file=join(directory,'snapshot.sqlite'); f=fixture(file);
    f.sqlite.exec('PRAGMA journal_mode=WAL; ALTER TABLE supplier_catalog_runs RENAME TO raw_runs');
    writer=new DatabaseSync(file);
    writer.prepare('INSERT INTO raw_runs SELECT ?,world,source,status,started_at,finished_at,before_count,candidate_count,added_count,changed_count,removed_count,error_code,diagnostics_json FROM raw_runs WHERE id=?').run('run-spa-new','run-spa');
    writer.prepare('INSERT INTO supplier_catalog_entries SELECT ?,?,world,supplier_id,summary_json,detail_json FROM supplier_catalog_entries WHERE id=?').run('entry-spa-new','run-spa-new','entry-spa');
    let changed=false;
    f.sqlite.function('concurrent_source',{deterministic:false},source=>{
      if(!changed){ changed=true; writer.exec("UPDATE supplier_catalog_state SET active_run_id='run-spa-new' WHERE world='spa'"); }
      return source;
    });
    f.sqlite.exec('CREATE VIEW supplier_catalog_runs AS SELECT id,world,concurrent_source(source) AS source,status,started_at,finished_at,before_count,candidate_count,added_count,changed_count,removed_count,error_code,diagnostics_json FROM raw_runs');
    const result=verifyActiveCatalogSnapshot(await exported(f));
    assert.equal(changed,true);
    assert.equal(writer.prepare("SELECT active_run_id AS id FROM supplier_catalog_state WHERE world='spa'").get().id,'run-spa-new');
    assert.equal(result.snapshot.states.find(s=>s.world==='spa').activeRunId,'run-spa');
    assert.ok(result.snapshot.entries.some(e=>e.id==='entry-spa'));
    assert.ok(!result.snapshot.entries.some(e=>e.id==='entry-spa-new'));
  } finally {writer?.close();f?.sqlite.close();rmSync(directory,{recursive:true,force:true});}
});

test('route uses only existing admin/database and no schema/config grants',()=>{
  const route=readFileSync(new URL('../app/api/admin/catalog-snapshot/route.ts',import.meta.url),'utf8');
  assert.match(route,/authorizedAdminSession/); assert.match(route,/catalogSnapshotResponse/);
  assert.doesNotMatch(route,/ensure|CREATE|ALTER|INSERT|UPDATE|DELETE|process\.env|Bearer|Secret/);
});
