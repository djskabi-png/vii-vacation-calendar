import assert from 'node:assert/strict';
import test from 'node:test';
import {withCmsD1} from './helpers/public-cms-d1-fixture.mjs';
import {populateCmsFixture} from './helpers/public-cms-sqlite-fixture.mjs';
import {publicCmsSnapshotResponse} from '../app/lib/public-cms-snapshot.ts';
import {verifyPublicCmsSnapshot} from '../infrastructure/postgres/public-cms-snapshot-reader.mjs';
const request=()=>new Request('https://synthetic.example.test/api/admin/public-cms-snapshot');
const response=db=>publicCmsSnapshotResponse(request(),{authorized:async()=>true,database:async()=>db});

test('actual D1 API compiles six families and bounded JSON functions, preserving nulls, arrays and one snapshot', {timeout:20000},async()=>{
 await withCmsD1(populateCmsFixture,async db=>{
  const r=await response(db);assert.equal(r.status,200);
  const result=verifyPublicCmsSnapshot(await r.text());
  assert.deepEqual(Object.values(result.counts),[1,1,1,1,1,1]);
  const pub=result.records.find(x=>x.family==='search-publication').data.content;
  assert.equal(pub.title,'Snapshot north');assert.equal(pub.version,null);
  assert.ok(Object.hasOwn(pub,'version'));assert.equal(pub.robotsIndex,null);
  const opportunity=result.records.find(x=>x.family==='search-opportunity').data;
  assert.deepEqual(opportunity.filters,{guests:6});assert.deepEqual(opportunity.faq,[]);
  assert.equal(result.sourceConsistencyVerified,false);
 });
});
test('actual D1 API produces explicit empty six-family completion', {timeout:20000},async()=>{
 await withCmsD1(null,async db=>{const r=await response(db);assert.equal(r.status,200);assert.equal(verifyPublicCmsSnapshot(await r.text()).records.length,0);});
});
test('actual D1 API fails closed on malformed published JSON, with no fallback or payload leakage', {timeout:20000},async()=>{
 await withCmsD1(f=>{populateCmsFixture(f);f.sqlite.exec("UPDATE vii_search_page_opportunities SET filters_json='not-json-SYNTHETIC_PRIVATE'");},async db=>{
  const r=await response(db);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'cms_snapshot_unavailable'});
 });
});
