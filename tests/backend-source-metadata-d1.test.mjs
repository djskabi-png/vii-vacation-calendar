import test from 'node:test';
import assert from 'node:assert/strict';
import {withCmsD1} from './helpers/public-cms-d1-fixture.mjs';
import {backendSourceMetadataResponse,METADATA_TABLES} from '../app/lib/backend-source-metadata.ts';

test('actual D1 observes all24fixed schemas and retry queue count without private row values or writes',{timeout:20000},async()=>{
 await withCmsD1(f=>{
  f.sqlite.exec(`CREATE TABLE supplier_catalog_runs(id TEXT PRIMARY KEY,world TEXT,status TEXT);
   CREATE TABLE supplier_catalog_entries(id TEXT PRIMARY KEY,run_id TEXT,world TEXT);
   CREATE TABLE supplier_catalog_state(world TEXT PRIMARY KEY,active_run_id TEXT,active_count INTEGER,accepted_at TEXT,lock_run_id TEXT);`);
  const present=new Set(f.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
  for(const name of METADATA_TABLES.filter(name=>!present.has(name))){
   f.sqlite.exec(`CREATE TABLE "${name}"(id TEXT PRIMARY KEY NOT NULL, private_payload TEXT NOT NULL); INSERT INTO "${name}" VALUES('synthetic','SYNTHETIC_PRIVATE_BODY_guest@example.test');`);
  }
 },async db=>{
  const queries=[];
  const wrapper={prepare(sql){queries.push(sql);return db.prepare(sql);},batch(statements){return db.batch(statements);}};
  const r=await backendSourceMetadataResponse(new Request('https://synthetic.example.test/api/admin/backend-readiness'),{authorized:async()=>true,database:async()=>wrapper});
  assert.equal(r.status,200);const body=await r.json();assert.equal(body.tables.length,24);assert.ok(body.tables.every(t=>t.exists));
  assert.equal(body.tables.find(t=>t.table==='supplier_catalog_retry_jobs').rowCount,1);
  assert.equal(body.tables.find(t=>t.table==='whatsapp_leads').rowCount,1);
  assert.deepEqual(body.totals,{runs:0,entries:0,states:0});
  assert.ok(!JSON.stringify(body).includes('SYNTHETIC_PRIVATE_BODY'));assert.ok(!JSON.stringify(body).includes('guest@example.test'));
  assert.ok(queries.every(q=>/^(SELECT|PRAGMA)\b/.test(q.trim())));
  assert.equal(body.observation.rowBodiesIncluded,false);assert.equal(body.observation.rowCountsObservedSeparately,true);
  for(const key of ['fullExport','sourceSnapshotVerified','migrationVerified','fullLaunchReady'])assert.equal(body[key],false);
 });
});
