import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { publicDiscoveryCatalogIndex } from '../app/lib/discovery-public-index.ts';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE supplier_catalog_state(world TEXT PRIMARY KEY, active_run_id TEXT, active_count INTEGER);
    CREATE TABLE supplier_catalog_entries(run_id TEXT,world TEXT,supplier_id INTEGER,summary_json TEXT,detail_json TEXT);`);
  let reads=0;
  const db={prepare(sql){reads++;return {bind(...values){return {async all(){return {results:sqlite.prepare(sql).all(...values)}}}}}}};
  const add=(run,id,name,location='ירושלים')=>sqlite.prepare('INSERT INTO supplier_catalog_entries VALUES (?,?,?,?,?)').run(run,'vacations',id,JSON.stringify({supplierId:id,name,location,area:'אזור ירושלים',lat:31.78,lng:35.22,images:Array(100).fill('large-gallery.jpg')}),'private-detail-must-never-be-selected');
  return {sqlite,db,add,reads:()=>reads};
}

test('discovery index reads a complete accepted generation in one compact query without a 20-place cap',async()=>{
  const f=fixture();try{
    f.sqlite.prepare('INSERT INTO supplier_catalog_state VALUES (?,?,?)').run('vacations','current',31);
    for(let id=1;id<=30;id++)f.add('current',id,`מקום ${id}`);
    f.add('current',99,'test123');f.add('old',500,'ישן');
    const result=await publicDiscoveryCatalogIndex('vacations',f.db);
    assert.equal(f.reads(),1);assert.equal(result.places.length,30);assert.equal(result.publishedIds.size,30);
    assert.ok(result.publishedIds.has(30));assert.ok(!result.publishedIds.has(99));assert.ok(!result.publishedIds.has(500));
    assert.equal(result.places[0].location,'ירושלים');
    assert.ok(!JSON.stringify(result).includes('large-gallery'));assert.ok(!JSON.stringify(result).includes('private-detail'));
  }finally{f.sqlite.close()}
});

test('partial accepted generation cannot be hidden by filtering or a bundled fallback',async()=>{
  const f=fixture();try{
    f.sqlite.prepare('INSERT INTO supplier_catalog_state VALUES (?,?,?)').run('vacations','current',2);f.add('current',1,'מקום');
    await assert.rejects(publicDiscoveryCatalogIndex('vacations',f.db),/catalog_active_generation_incomplete/);
  }finally{f.sqlite.close()}
});

test('a database outage reuses the accepted bundled publication inventory without fabricated empty results',async()=>{
  const result=await publicDiscoveryCatalogIndex('vacations',{prepare(){throw Error('read_outage')}});
  assert.ok(result.places.length>20);assert.equal(result.places.length,result.publishedIds.size);
  assert.ok(!result.publishedIds.has(389),'previously removed supplier must not return in fallback');
});

test('an accepted empty generation stays empty and does not revive the bundle',async()=>{
  const f=fixture();try{
    f.sqlite.prepare('INSERT INTO supplier_catalog_state VALUES (?,?,?)').run('vacations','empty',0);
    const result=await publicDiscoveryCatalogIndex('vacations',f.db);assert.equal(result.places.length,0);
  }finally{f.sqlite.close()}
});

test('invalid and duplicate active identities cannot masquerade as a complete generation',async()=>{
  for (const invalid of [0,-1,1.5,'invalid']) {
    const f=fixture();try{
      f.sqlite.prepare('INSERT INTO supplier_catalog_state VALUES (?,?,?)').run('vacations','current',1);
      f.add('current',invalid,'שם קיים');
      await assert.rejects(publicDiscoveryCatalogIndex('vacations',f.db),/catalog_active_generation_invalid_identity/);
    }finally{f.sqlite.close()}
  }
  const f=fixture();try{
    f.sqlite.prepare('INSERT INTO supplier_catalog_state VALUES (?,?,?)').run('vacations','current',2);
    f.add('current',1,'ראשון');f.add('current',1,'כפול');
    await assert.rejects(publicDiscoveryCatalogIndex('vacations',f.db),/catalog_active_generation_invalid_identity/);
  }finally{f.sqlite.close()}
});

test('event generation uses the same complete, uncapped publication boundary',async()=>{
  const f=fixture();try{
    f.sqlite.prepare('INSERT INTO supplier_catalog_state VALUES (?,?,?)').run('events','event-current',30);
    for(let id=1;id<=30;id++) f.add('event-current',id,`אירוע ${id}`);
    f.sqlite.exec("UPDATE supplier_catalog_entries SET world='events'");
    const result=await publicDiscoveryCatalogIndex('events',f.db);
    assert.equal(result.publishedIds.size,30);assert.equal(result.places.length,30);assert.equal(f.reads(),1);
  }finally{f.sqlite.close()}
});
