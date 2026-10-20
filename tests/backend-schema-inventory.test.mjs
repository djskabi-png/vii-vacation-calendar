import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {readBackendSchemaInventory,backendSchemaInventoryResponse} from '../app/lib/backend-schema-inventory.ts';
const endpoint='https://vii.spaplus.co/api/admin/source-schema-inventory';
const statements=[
 `CREATE TABLE parent(id TEXT PRIMARY KEY NOT NULL,label VARCHAR(255) DEFAULT 'PRIVATE_DEFAULT',UNIQUE(label))`,
 `CREATE TABLE audit(payload TEXT)`,
 `CREATE TABLE child(id INTEGER PRIMARY KEY AUTOINCREMENT,parent_id TEXT REFERENCES parent(id) ON DELETE CASCADE,label TEXT COLLATE NOCASE,derived TEXT GENERATED ALWAYS AS (label || 'PRIVATE_GENERATED') STORED,CHECK(label != 'PRIVATE_CHECK'))`,
 `CREATE UNIQUE INDEX child_expression ON child(lower(label) COLLATE NOCASE DESC) WHERE label != 'PRIVATE_PARTIAL'`,
 `CREATE VIEW child_view AS SELECT id,label FROM child`,
 `CREATE TRIGGER child_audit AFTER INSERT ON child BEGIN INSERT INTO audit VALUES('PRIVATE_TRIGGER'); END`,
 `CREATE TABLE "odd""name'); DROP TABLE parent;--"(x TEXT DEFAULT 'PRIVATE_ODD')`,
 `CREATE VIRTUAL TABLE search_fts USING fts5(body)`
];
function fixture(transform){
 const sqlite=new DatabaseSync(':memory:');for(const sql of statements)sqlite.exec(sql);
 sqlite.exec(`INSERT INTO parent VALUES('PRIVATE_ID','PRIVATE_LABEL');INSERT INTO child(parent_id,label) VALUES('PRIVATE_ID','PRIVATE_ROW');`);
 const queries=[];const db={prepare(sql){return {all:async()=>{queries.push(sql);const result={success:true,results:sqlite.prepare(sql).all()};return transform?transform(sql,result,sqlite):result;}};}};
 return {sqlite,db,queries};
}
const deps=db=>({authorized:async()=>true,database:async()=>db});
const request=(path=endpoint,options)=>new Request(path,options);
test('complete SQLite inventory covers undeclared objects, virtual/shadow/internal and definition hashes',async()=>{
 const f=fixture();try{
  const before=f.sqlite.prepare('SELECT total_changes() AS n').get().n;
  const r=await readBackendSchemaInventory(f.db);
  const names=f.sqlite.prepare('SELECT name FROM sqlite_master ORDER BY name').all().map(o=>o.name);
  assert.deepEqual(r.objects.map(o=>o.name).sort(),names.sort());assert.ok(r.totals.virtualTables>0);assert.ok(r.totals.internalObjects>0);
  assert.equal(r.objects.find(o=>o.name==='search_fts').virtual,true);
  assert.equal(r.objects.find(o=>o.name==='sqlite_sequence').internal,true);
  assert.match(r.schemaFingerprint,/^[a-f0-9]{64}$/);
  assert.ok(r.objects.every(o=>o.definitionSha256===null||/^[a-f0-9]{64}$/.test(o.definitionSha256)));
  assert.equal(f.sqlite.prepare('SELECT total_changes() AS n').get().n,before);
  assert.ok(f.queries.every(q=>q.startsWith('SELECT type,name,tbl_name,sql FROM sqlite_master ')||/^PRAGMA (table_xinfo|index_list|index_xinfo|foreign_key_list)\(/.test(q)));
 }finally{f.sqlite.close();}
});
test('columns/defaults/generated, unique partial expression index and FK semantics are structural only',async()=>{
 const f=fixture();try{
  const r=await readBackendSchemaInventory(f.db),parent=r.objects.find(o=>o.name==='parent'),child=r.objects.find(o=>o.name==='child');
  const label=parent.columns.find(c=>c.name==='label');assert.equal(label.type,'VARCHAR(255)');assert.equal(label.defaultPresent,true);assert.match(label.defaultSha256,/^[a-f0-9]{64}$/);
  assert.equal(child.columns.find(c=>c.name==='derived').hidden,3);
  const ix=child.indexes.find(i=>i.name==='child_expression');assert.equal(ix.unique,true);assert.equal(ix.partial,true);assert.equal(ix.origin,'c');
  assert.ok(ix.keys.some(k=>k.expression&&k.descending&&k.collation==='NOCASE'));
  assert.equal(child.foreignKeys[0].onDelete,'CASCADE');assert.equal(child.foreignKeys[0].table,'parent');
  assert.ok(parent.indexes.some(i=>i.origin==='u'));assert.ok(parent.indexes.some(i=>i.origin==='pk'));
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE_DEFAULT|PRIVATE_TRIGGER|PRIVATE_PARTIAL|PRIVATE_GENERATED|PRIVATE_CHECK|PRIVATE_ROW|PRIVATE_ID|PRIVATE_ODD/);
 }finally{f.sqlite.close();}
});
test('quoted malicious object names are safely read, never executed as SQL',async()=>{
 const f=fixture();try{const r=await readBackendSchemaInventory(f.db);assert.ok(r.objects.some(o=>o.name===`odd"name'); DROP TABLE parent;--`));assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM parent').get().n,1);}finally{f.sqlite.close();}
});
test('reload yields stable schema fingerprint and all migration/atomic claims stay false',async()=>{
 const f=fixture();try{const a=await readBackendSchemaInventory(f.db),b=await readBackendSchemaInventory(f.db);assert.equal(a.schemaFingerprint,b.schemaFingerprint);
  for(const k of ['fullExport','sourceSnapshotVerified','migrationVerified','fullLaunchReady'])assert.equal(a[k],false);
  for(const k of ['atomic','rowBodiesIncluded','rawDefinitionsIncluded','rawDefaultsIncluded','physicalStorageIdentityVerified'])assert.equal(a.observation[k],false);
 }finally{f.sqlite.close();}
});
test('schema change between boundary reads refuses partial inventory',async()=>{
 let boundary=0;const f=fixture((sql,r)=>{if(sql.startsWith('SELECT type')&&++boundary===2)r.results.pop();return r;});
 try{await assert.rejects(readBackendSchemaInventory(f.db),/schema_inventory_unavailable/);}finally{f.sqlite.close();}
});
test('object count, definition and column limits reject rather than truncate',async()=>{
 for(const change of [r=>{r.results=Array.from({length:513},(_,i)=>({type:'table',name:'x'+i,tbl_name:'x'+i,sql:'CREATE TABLE x(a)'}));},r=>{r.results[0].sql='x'.repeat(131073);},r=>{r.results[0].name='x'.repeat(257);}]){
  const f=fixture((sql,r)=>{if(sql.startsWith('SELECT type'))change(r);return r;});try{await assert.rejects(readBackendSchemaInventory(f.db),/schema_inventory_unavailable/);}finally{f.sqlite.close();}
 }
 const f=fixture((sql,r)=>{if(sql.startsWith('PRAGMA table_xinfo'))r.results=Array.from({length:257},()=>r.results[0]);return r;});try{await assert.rejects(readBackendSchemaInventory(f.db),/schema_inventory_unavailable/);}finally{f.sqlite.close();}
});
test('malformed/unknown/duplicate metadata is rejected without raw error/body passthrough',async()=>{
 const mutations=[(sql,r)=>{if(sql.startsWith('SELECT type'))r.results[0].type='unknown';},(sql,r)=>{if(sql.startsWith('SELECT type'))r.results.push(r.results[0]);},(sql,r)=>{if(sql.startsWith('PRAGMA table_xinfo'))r.results[0].notnull=3;},(sql,r)=>{if(sql.startsWith('PRAGMA index_list')&&r.results.length)r.results[0].unique=9;},(sql,r)=>{if(sql.startsWith('PRAGMA foreign_key_list')&&r.results.length)r.results[0].on_delete='PRIVATE_ACTION';}];
 for(const mutate of mutations){const f=fixture((sql,r)=>{mutate(sql,r);return r;});try{const response=await backendSchemaInventoryResponse(request(),deps(f.db));assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'schema_inventory_unavailable'});}finally{f.sqlite.close();}}
});
test('missing/unsupported metadata fails closed; no raw provider exception',async()=>{
 for(const db of [{prepare(){return {all:async()=>({success:false,results:[]})};}},{prepare(){return {all:async()=>{throw Error('PRIVATE_DATABASE_ERROR');}};}}]){
  const r=await backendSchemaInventoryResponse(request(),deps(db));assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'schema_inventory_unavailable'});
 }
});
test('empty actual schema is complete empty metadata, not fabricated tables or migration',async()=>{
 const sqlite=new DatabaseSync(':memory:');try{const db={prepare(sql){return {all:async()=>({success:true,results:sqlite.prepare(sql).all()})};}};const r=await readBackendSchemaInventory(db);assert.equal(r.totals.objects,0);assert.equal(r.fullLaunchReady,false);}finally{sqlite.close();}
});
test('strict auth, wrong path, query, origin and nonGET all deny before DB acquisition',async()=>{
 for(const [authorized,url,method,headers,status]of [[false,endpoint,'GET',{},403],[1,endpoint,'GET',{},403],[true,endpoint+'?table=parent','GET',{},400],[true,endpoint,'POST',{},405],[true,endpoint,'GET',{origin:'https://evil.test'},403],[true,'https://vii.spaplus.co/wrong','GET',{},404]]){
  let calls=0;const r=await backendSchemaInventoryResponse(request(url,{method,headers}),{authorized:async()=>authorized,database:async()=>{calls++;throw Error('no');}});assert.equal(r.status,status);assert.equal(calls,0);
 }
});
test('private response headers and real route wiring preserve existing admin without new env secrets',async()=>{
 const f=fixture();try{const r=await backendSchemaInventoryResponse(request(),deps(f.db));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(r.headers.get('x-content-type-options'),'nosniff');}finally{f.sqlite.close();}
 const route=readFileSync(new URL('../app/api/admin/source-schema-inventory/route.ts',import.meta.url),'utf8');assert.match(route,/authorizedAdminSession/);assert.match(route,/requiredRuntimeDatabase/);assert.doesNotMatch(route,/process\.env|TOKEN|SECRET/);
});
test('actual pinned D1 supports complete schema inventory including FT5, quoted names and expressions',{timeout:30000},async()=>{
 const req=createRequire(import.meta.url),dependency=createRequire(req.resolve('wrangler')), {Miniflare}=dependency('miniflare');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("synthetic-only")}}',compatibilityDate:'2026-05-15',d1Databases:{DB:'synthetic-schema-inventory'}});
 try{const db=await mf.getD1Database('DB');for(const sql of statements)await db.prepare(sql).run();
  await db.prepare(`INSERT INTO parent VALUES('PRIVATE_ID','PRIVATE_LABEL')`).run();
  const queries=[],wrapper={prepare(sql){queries.push(sql);return db.prepare(sql);}};
  let body;try{body=await readBackendSchemaInventory(wrapper);}catch(error){throw Error(`Synthetic D1 schema inventory failed at ${queries.at(-1)}`,{cause:error});}
  assert.equal(body.objects.find(o=>o.name==='_cf_METADATA').inspection,'provider-managed-details-not-requested');
  assert.equal(body.observation.providerInternalDetailsInspected,false);
  assert.ok(body.objects.find(o=>o.name==='child_expression'));assert.ok(body.objects.find(o=>o.name==='child_audit'));assert.ok(body.objects.find(o=>o.virtual));
  assert.ok(body.objects.find(o=>o.name==='child').indexes.find(i=>i.name==='child_expression').keys.some(k=>k.expression));
  assert.equal(body.observation.rawDefinitionsIncluded,false);assert.doesNotMatch(JSON.stringify(body),/PRIVATE_DEFAULT|PRIVATE_TRIGGER|PRIVATE_PARTIAL|PRIVATE_ROW|PRIVATE_ID/);
  assert.ok(queries.every(q=>q.startsWith('SELECT type,name,tbl_name,sql FROM sqlite_master ')||q.startsWith('PRAGMA ')));
 }finally{await mf.dispose();}
});
