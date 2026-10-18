import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {PUBLIC_CMS_PROJECTION_SQL,validatePublicCmsProjection} from '../infrastructure/postgres/public-cms-projection.mjs';
const now='2026-10-18T06:00:00.000Z',future='2026-10-19T06:00:00.000Z',past='2026-10-17T06:00:00.000Z';
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../drizzle/0008_content_studio.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../drizzle/0006_search_intelligence.sql',import.meta.url),'utf8'));
 db.exec(`CREATE TABLE vii_search_page_versions(id TEXT PRIMARY KEY,path TEXT,title TEXT,description TEXT,status TEXT,scheduled_at TEXT,version INTEGER,updated_at TEXT,updated_by TEXT);
 CREATE TABLE vii_geography_nodes(node_key TEXT PRIMARY KEY,level TEXT,supplier_id INTEGER,parent_key TEXT,supplier_title TEXT,supplier_title_en TEXT,title_override TEXT,title_en_override TEXT,slug TEXT,visible INTEGER,featured INTEGER,gps_lat REAL,gps_long REAL,unassigned INTEGER,version INTEGER,updated_by TEXT);
 CREATE TABLE vii_redirects(source_path TEXT PRIMARY KEY,target_path TEXT,status INTEGER,active INTEGER,updated_by TEXT);
 CREATE TABLE private_customer_bookings(secret TEXT); INSERT INTO private_customer_bookings VALUES('CUSTOMER_SECRET');`);
 return db;
}
function item(db,id,status='draft',schedule=null,published=1){
 const itemId='homepage:'+id+':he';
 db.prepare('INSERT INTO vii_content_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(itemId,'homepage',id,'vacation','he','source','{"privateSource":"SECRET_SOURCE"}','{"title":"DRAFT_SECRET"}',status,schedule,2,published,past,'PRIVATE_ACTOR');
 for(const version of [1,2]) db.prepare('INSERT INTO vii_content_versions VALUES(?,?,?,?,?,?,?,?,?)').run(itemId+version,itemId,version,'save',version===1?'published':'draft',JSON.stringify({title:version===1?'PUBLISHED':'LATEST',links:[{label:'צפון',href:'/vacations/north'}],attributes:{hero:'public'},unknownPrivate:'EXTRA_SECRET'}),schedule,past,'PRIVATE_AUTHOR');
}
const read=db=>db.prepare(PUBLIC_CMS_PROJECTION_SQL).all(now);
test('effective editorial version follows published pointer while draft/future remains private',()=>{
 const db=fixture();try{
 item(db,'draft-edits');item(db,'future','scheduled',future);item(db,'mature','scheduled',past);item(db,'new','draft',null,null);item(db,'archived','archived');
 const rows=read(db),result=validatePublicCmsProjection(rows,now);
 assert.equal(result.counts.editorial,3);
 assert.equal(result.records.find(x=>x.data.entityKey==='draft-edits').data.content.title,'PUBLISHED');
 assert.equal(result.records.find(x=>x.data.entityKey==='future').data.content.title,'PUBLISHED');
 assert.equal(result.records.find(x=>x.data.entityKey==='mature').data.content.title,'LATEST');
 assert.deepEqual(result.records[0].data.content.links,[{label:'צפון',href:'/vacations/north'}]);
 assert.doesNotMatch(JSON.stringify(result),/SECRET|PRIVATE_ACTOR|PRIVATE_AUTHOR/);
 assert.equal(result.limitations.liveSourceVerified,false);assert.equal(result.limitations.migrationVerified,false);
 }finally{db.close();}
});
test('search versions exclude future/draft and preserve the latest eligible version',()=>{
 const db=fixture();try{
 for(const [version,status,schedule] of [[1,'published',null],[2,'scheduled',past],[3,'scheduled',future],[4,'draft',null]])
  db.prepare('INSERT INTO vii_search_page_versions VALUES(?,?,?,?,?,?,?,?,?)').run('v'+version,'/vacations/north','title'+version,'desc',status,schedule,version,past,'PRIVATE_ACTOR');
 const rows=read(db);assert.equal(rows.length,1);assert.equal(JSON.parse(rows[0].data).version,2);
 }finally{db.close();}
});
test('published snapshot is separate from latest draft opportunity and omits administrative fields',()=>{
 const db=fixture();try{
 db.prepare('INSERT INTO vii_search_page_publications VALUES(?,?,?,?,?,?,?,?)').run('o','/search/vacations/north','he','vacation',JSON.stringify({title:'PUBLIC_SNAPSHOT',updatedBy:'PRIVATE_ACTOR',assignee:'PRIVATE_ASSIGNEE',searches:99,body:'Public text'}),null,past,past);
 db.prepare('INSERT INTO vii_search_page_publications VALUES(?,?,?,?,?,?,?,?)').run('future','/search/vacations/future','he','vacation','{"title":"FUTURE_SECRET"}',future,past,past);
 const rows=read(db);assert.equal(rows.length,1);assert.equal(JSON.parse(rows[0].data).content.title,'PUBLIC_SNAPSHOT');
 assert.doesNotMatch(JSON.stringify(rows),/PRIVATE_|FUTURE_SECRET|searches/);
 }finally{db.close();}
});
test('only public indexable opportunities are projected, with exact filters and no actor or analytics metadata',()=>{
 const db=fixture();try{
 for(const [id,status,schedule,indexable] of [['public','published',null,1],['mature','scheduled',past,1],['future','scheduled',future,1],['draft','draft',null,1],['noindex','published',null,0]]){
  db.prepare(`INSERT INTO vii_search_page_opportunities(id,canonical_key,world,locale,location,filters_json,source_path,proposed_path,suggested_title,first_seen_at,last_seen_at,status,scheduled_at,robots_index,assignee,updated_by,search_count,title,version)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,id,'vacation','he','צפון','{"guests":6,"online":true}','/search','/search/vacations/'+id,'suggested',past,past,status,schedule,indexable,'PRIVATE_ASSIGNEE','PRIVATE_ACTOR',123,'title',2);
 }
 const rows=read(db);assert.equal(rows.length,2);assert.deepEqual(rows.map(x=>x.identity),['mature','public']);
 assert.deepEqual(JSON.parse(rows[0].data).filters,{guests:6,online:true});
 assert.doesNotMatch(JSON.stringify(rows),/PRIVATE_|search_count|first_seen_at|last_seen_at/);
 }finally{db.close();}
});
test('visible geography/active redirects retained, inactive rows and identities omitted, no DB writes',()=>{
 const db=fixture();try{
 for(const visible of [0,1]) db.prepare('INSERT INTO vii_geography_nodes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('city:'+visible,'city',visible,null,'city','City','','','city',visible,1,32,35,0,2,'PRIVATE_ACTOR');
 for(const active of [0,1]) db.prepare('INSERT INTO vii_redirects VALUES(?,?,?,?,?)').run('/legacy'+active,'/vacations/north',301,active,'PRIVATE_ACTOR');
 const before=db.prepare('SELECT total_changes() AS n').get().n;
 const rows=read(db);assert.equal(db.prepare('SELECT total_changes() AS n').get().n,before);
 const result=validatePublicCmsProjection(rows,now);assert.equal(result.counts.geography,1);assert.equal(result.counts.redirect,1);
 assert.doesNotMatch(JSON.stringify(rows),/PRIVATE_ACTOR|CUSTOMER_SECRET/);
 }finally{db.close();}
});
test('bounds, duplicate identities, malformed JSON and time fail closed',()=>{
 const row={family:'redirect',identity:'/old',data:'{"sourcePath":"/old"}'};
 assert.throws(()=>validatePublicCmsProjection([row,row],now),/duplicate/);
 assert.throws(()=>validatePublicCmsProjection([{...row,family:'customer'}],now),/invalid/);
 assert.throws(()=>validatePublicCmsProjection([{...row,data:'{'}],now));
 assert.throws(()=>validatePublicCmsProjection([{...row,data:JSON.stringify({x:'x'.repeat(1900000)})}],now),/limit/);
 assert.throws(()=>validatePublicCmsProjection([row],'2026-02-30T00:00:00.000Z'),/time/);
 assert.throws(()=>validatePublicCmsProjection([row],future+';DROP'));
});
test('geography preserves the public effective Hebrew/English title, including independent empty fallback',()=>{
 const db=fixture();try{
 for(const [key,he,en] of [['both','שם ערוך','Edited name'],['he-only','עברית ערוכה',''],['none','','']])
  db.prepare('INSERT INTO vii_geography_nodes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(key,'city',1,null,'שם ספק','Supplier name',he,en,key,1,0,32,35,0,2,'PRIVATE_ACTOR');
 const records=validatePublicCmsProjection(read(db),now).records;
 assert.equal(records.find(x=>x.identity==='both').data.title,'שם ערוך');
 assert.equal(records.find(x=>x.identity==='both').data.titleEn,'Edited name');
 assert.equal(records.find(x=>x.identity==='he-only').data.title,'עברית ערוכה');
 assert.equal(records.find(x=>x.identity==='he-only').data.titleEn,'Supplier name');
 assert.equal(records.find(x=>x.identity==='none').data.title,'שם ספק');
 }finally{db.close();}
});
