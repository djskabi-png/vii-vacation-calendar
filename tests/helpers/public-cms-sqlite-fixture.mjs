import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function cmsFixture(file=':memory:'){
 const sqlite=new DatabaseSync(file);
 sqlite.exec(readFileSync(new URL('../../drizzle/0008_content_studio.sql',import.meta.url),'utf8'));
 sqlite.exec(readFileSync(new URL('../../drizzle/0006_search_intelligence.sql',import.meta.url),'utf8'));
 sqlite.exec(`CREATE TABLE vii_search_page_versions(id TEXT PRIMARY KEY,path TEXT,title TEXT,description TEXT,status TEXT,scheduled_at TEXT,version INTEGER,updated_at TEXT,updated_by TEXT);
 CREATE TABLE vii_geography_nodes(node_key TEXT PRIMARY KEY,level TEXT,supplier_id INTEGER,parent_key TEXT,supplier_title TEXT,supplier_title_en TEXT,title_override TEXT,title_en_override TEXT,slug TEXT,visible INTEGER,featured INTEGER,gps_lat REAL,gps_long REAL,unassigned INTEGER,version INTEGER,updated_by TEXT);
 CREATE TABLE vii_redirects(source_path TEXT PRIMARY KEY,target_path TEXT,status INTEGER,active INTEGER,updated_by TEXT);
 CREATE TABLE private_customer_bookings(secret TEXT); INSERT INTO private_customer_bookings VALUES('CUSTOMER_SECRET');`);
 const queries=[];
 const db={prepare:sql=>({bind:(...args)=>({all:async()=>{queries.push({sql,args});return {success:true,results:sqlite.prepare(sql).all(...args)};}})})};
 return {sqlite,db,queries};
}
export function populateCmsFixture(f){
 const db=f.sqlite,past='2020-01-01T00:00:00.000Z';
 db.prepare('INSERT INTO vii_content_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('homepage:primary:he','homepage','primary','vacation','he','source','{"private":"SOURCE_SECRET"}','{"title":"DRAFT_SECRET"}','draft',null,2,1,past,'PRIVATE_ACTOR');
 db.prepare('INSERT INTO vii_content_versions VALUES(?,?,?,?,?,?,?,?,?)').run('version1','homepage:primary:he',1,'publish','published','{"title":"Public title","body":"Published text שלום","links":[],"attributes":{}}',null,past,'PRIVATE_ACTOR');
 db.prepare('INSERT INTO vii_content_versions VALUES(?,?,?,?,?,?,?,?,?)').run('version2','homepage:primary:he',2,'save','draft','{"title":"DRAFT_SECRET"}',null,past,'PRIVATE_ACTOR');
 db.prepare('INSERT INTO vii_search_page_versions VALUES(?,?,?,?,?,?,?,?,?)').run('v1','/vacations/north','Public north','Description','published',null,1,past,'PRIVATE_ACTOR');
 db.prepare(`INSERT INTO vii_search_page_opportunities(id,canonical_key,world,locale,location,filters_json,source_path,proposed_path,suggested_title,first_seen_at,last_seen_at,status,robots_index,title,version,updated_by)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('opp','opp','vacation','he','צפון','{"guests":6}','/search','/search/vacations/north','Suggested',past,past,'published',1,'Public north',1,'PRIVATE_ACTOR');
 db.prepare('INSERT INTO vii_search_page_publications VALUES(?,?,?,?,?,?,?,?)').run('opp','/search/vacations/north','he','vacation','{"id":"opp","title":"Snapshot north","body":"Public body","updatedBy":"PRIVATE_ACTOR","assignee":"PRIVATE_ASSIGNEE"}',null,past,past);
 db.prepare('INSERT INTO vii_geography_nodes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('city:1','city',1,null,'עיר','City','','','city',1,0,32,35,0,1,'PRIVATE_ACTOR');
 db.prepare('INSERT INTO vii_redirects VALUES(?,?,?,?,?)').run('/legacy','/vacations/north',301,1,'PRIVATE_ACTOR');
}
