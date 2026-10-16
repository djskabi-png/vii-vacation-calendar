import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { readSupplierCatalogSummaries, readSupplierCatalogDetails, readSupplierCatalogReviewDetails } from '../app/lib/supplier-catalog-store.ts';

function fixture() {
  const sql = new DatabaseSync(':memory:'); let statements = 0;
  sql.exec(`CREATE TABLE supplier_catalog_state(world TEXT, active_run_id TEXT, active_count INTEGER, accepted_at TEXT);
    CREATE TABLE supplier_catalog_entries(run_id TEXT, world TEXT, supplier_id INTEGER, summary_json TEXT, detail_json TEXT);`);
  const db = { prepare(query) { statements++; let bindings=[]; return {
    bind(...values) { bindings=values; return this; },
    async first() { return sql.prepare(query).get(...bindings) || null; },
    async all() { return {results:sql.prepare(query).all(...bindings)}; }
  }; } };
  return {sql, db, get statements(){return statements;}};
}

test('selected immutable generation avoids redundant state read and stays consistent across publication',async()=>{
  const f=fixture();
  try {
    f.sql.exec(`INSERT INTO supplier_catalog_state VALUES('vacations','new',1,'new-time');
      INSERT INTO supplier_catalog_entries VALUES('old','vacations',1,'{"name":"old"}',NULL);
      INSERT INTO supplier_catalog_entries VALUES('new','vacations',1,'{"name":"new"}',NULL);`);
    const pinned=await readSupplierCatalogSummaries(f.db,'vacations',{activeRunId:'old',activeCount:1,acceptedAt:'old-time'});
    assert.equal(pinned.entries[0].summary.name,'old'); assert.equal(pinned.acceptedAt,'old-time');
    assert.equal(f.statements,1);
    const current=await readSupplierCatalogSummaries(f.db,'vacations');
    assert.equal(current.entries[0].summary.name,'new'); assert.equal(f.statements,3);
    await assert.rejects(readSupplierCatalogSummaries(f.db,'vacations',{activeRunId:'old',activeCount:2}),/incomplete/);
  } finally {f.sql.close();}
});

test('review projection returns exactly the same reviews without transferring unrelated full detail',async()=>{
  const f=fixture();
  try {
    const data=JSON.parse(await readFile(new URL('../app/data/sergey-place-details.json',import.meta.url),'utf8'));
    const candidates=Object.entries(data.details).filter(([key,value])=>key.startsWith('vacation-')&&Array.isArray(value.reviews)&&value.reviews.length).slice(0,14);
    assert.ok(candidates.length>0);
    f.sql.prepare('INSERT INTO supplier_catalog_state VALUES(?,?,?,?)').run('vacations','accepted',candidates.length,'today');
    for(const [key,detail] of candidates)f.sql.prepare('INSERT INTO supplier_catalog_entries VALUES(?,?,?,?,?)').run('accepted','vacations',Number(key.slice(9)),'{}',JSON.stringify(detail));
    const ids=candidates.map(([key])=>Number(key.slice(9)));
    const full=await readSupplierCatalogDetails(f.db,'vacations',ids);
    const projected=await readSupplierCatalogReviewDetails(f.db,'vacations',[...ids,ids[0],-1,NaN]);
    assert.equal(projected.size,candidates.length);
    for(const id of ids){assert.deepEqual(projected.get(id).reviews,full.get(id).reviews);assert.deepEqual(Object.keys(projected.get(id)),['reviews']);}
    const before=Buffer.byteLength(JSON.stringify([...full])); const after=Buffer.byteLength(JSON.stringify([...projected]));
    assert.ok(after<before); console.log(JSON.stringify({reviewProjectionBytes:{before,after,reductionPercent:Math.round((1-after/before)*100)}}));
    assert.equal((await readSupplierCatalogReviewDetails(f.db,'vacations',[])).size,0);
    assert.equal((await readSupplierCatalogReviewDetails(f.db,'events',ids)).size,0);
  }finally{f.sql.close();}
});

test('cold path starts published overlays in parallel and does not reload the active generation',async()=>{
  const source=await readFile(new URL('../app/lib/public-catalog-read.ts',import.meta.url),'utf8');
  assert.ok(source.indexOf('const overlays = readPublishedItems')<source.indexOf('const state = await readSupplierCatalogState'));
  assert.match(source,/readSupplierCatalogSummaries\(db, world, state\)/);
  assert.doesNotMatch(source,/readPublishedContentBatch/);
  const worker=await readFile(new URL('../worker/index.ts',import.meta.url),'utf8');
  assert.match(worker,/if \(cachePolicy && !refreshPublic\)/);
  assert.match(worker,/worker.fetch\(request, env, ctx, true\)/);
  const page=await readFile(new URL('../app/page.tsx',import.meta.url),'utf8');
  assert.match(page,/export default function HomePage\(\)/);
  assert.match(page,/<HomeLiveSections \/>\s*<Suspense fallback=\{<HomeCatalogLoading \/>\}><HomeCatalogShowcase \/><\/Suspense>/);
});
