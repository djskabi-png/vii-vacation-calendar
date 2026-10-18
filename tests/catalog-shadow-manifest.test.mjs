import test from 'node:test';
import assert from 'node:assert/strict';
import {SHADOW_MANIFEST_SQL,SHADOW_WORLDS,validateShadowManifest,compareShadowManifest} from '../infrastructure/postgres/catalog-shadow-manifest.mjs';
const fixture=()=>({database:'vii',role:'vii_stage_catalog_reader',readOnly:true,
 worlds:SHADOW_WORLDS.map((world,i)=>({world,activeRunId:'source-'+world,activeCount:i+1,entryCount:i+1,runCount:1,sha256:String(i).repeat(64)}))});
const source=()=>fixture().worlds.map(({world,activeRunId,activeCount})=>({world,activeRunId,activeCount,lockRunId:null,lockUntil:null}));
test('fixed SQL reads only fully qualified catalog tables and computes hashes before response',()=>{
 const sql=SHADOW_MANIFEST_SQL;
 assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|GRANT|CREATE|DROP|ALTER|COPY)\b|\$\d/i);
 assert.equal((sql.match(/AT TIME ZONE 'UTC'/g)??[]).length,4);
 assert.match(sql,/sha256\(convert_to\(doc::text,'UTF8'\)\)/);
 assert.match(sql,/ORDER BY e.id COLLATE "C"/);
 const tables=[...sql.matchAll(/\b(?:FROM|JOIN)\s+(vii_stage_catalog_shadow\.[a-z_]+)/g)].map(m=>m[1]);
 assert.deepEqual([...new Set(tables)].sort(),['supplier_catalog_entries','supplier_catalog_runs','supplier_catalog_state'].map(x=>'vii_stage_catalog_shadow.'+x));
});
test('four-world projected parity returns only bounded metadata',()=>{
 const actual=fixture(),before=JSON.stringify(actual);
 const result=compareShadowManifest(actual,fixture().worlds,source());
 assert.equal(result.ok,true);assert.equal(result.worlds.length,4);
 assert.equal(result.rawWholeRowParity,false);assert.equal(result.fullLaunchReady,false);
 assert.doesNotMatch(JSON.stringify(result),/sha256|summary_json|detail_json/);
 assert.equal(JSON.stringify(actual),before);
});
test('identity, readonly and top-level unknown fields fail closed',()=>{
 for(const change of [{role:'vii_owner'},{database:'other'},{readOnly:false},{unexpected:true}])
  assert.throws(()=>validateShadowManifest({...fixture(),...change}),/invalid_shadow_identity/);
});
test('missing, duplicate, extra and unknown worlds fail',()=>{
 for(const mutate of [v=>v.worlds.pop(),v=>v.worlds.push({...v.worlds[0]}),
  v=>v.worlds[1]={...v.worlds[0]},v=>v.worlds[0].world='other']){
  const value=fixture();mutate(value);assert.throws(()=>validateShadowManifest(value),/invalid_shadow_world/);
 }
});
test('world unknown fields, hashes, IDs and count inconsistencies fail',()=>{
 for(const change of [{extra:true},{sha256:'not-a-hash'},{sha256:7},{activeRunId:'bad space'},
  {activeCount:0},{activeCount:1.5},{entryCount:100},{runCount:2}]){
  const value=fixture();Object.assign(value.worlds[0],change);
  assert.throws(()=>validateShadowManifest(value),/invalid_shadow_world/);
 }
});
test('manifest ordering does not change deterministic comparison',()=>{
 const actual=fixture();actual.worlds.reverse();const expected=fixture().worlds.reverse();
 assert.equal(compareShadowManifest(actual,expected,source().reverse()).ok,true);
});
test('tampered full-row hash and changed Stage generation fail',()=>{
 for(const change of [{sha256:'f'.repeat(64)},{activeRunId:'other'}]){
  const value=fixture();Object.assign(value.worlds[0],change);
  assert.throws(()=>compareShadowManifest(value,fixture().worlds,source()),/shadow_parity_mismatch/);
 }
});
test('source generation/count drift and source locks cannot pass frozen snapshot parity',()=>{
 for(const change of [{activeRunId:'new-source'},{activeCount:100},{lockRunId:'running'},{lockUntil:'2026-10-18'}]){
  const current=source();Object.assign(current[0],change);
  assert.throws(()=>compareShadowManifest(fixture(),fixture().worlds,current),/stale_source_generation|invalid_source_generations/);
 }
});
test('missing, extra, duplicate and unknown source metadata fail',()=>{
 for(const mutate of [v=>v.pop(),v=>v.push({...v[0]}),v=>v[1]={...v[0]},v=>v[0].extra=true]){
  const current=source();mutate(current);
  assert.throws(()=>compareShadowManifest(fixture(),fixture().worlds,current),/invalid_source_generations/);
 }
});
