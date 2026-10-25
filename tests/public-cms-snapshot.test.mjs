import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cmsFixture,populateCmsFixture} from './helpers/public-cms-sqlite-fixture.mjs';
import {publicCmsSnapshotResponse} from '../app/lib/public-cms-snapshot.ts';
import {PUBLIC_CMS_SNAPSHOT_SQL} from '../app/lib/public-cms-source.ts';
import {verifyPublicCmsSnapshot} from '../infrastructure/postgres/public-cms-snapshot-reader.mjs';
import {authorizedAdminSession} from '../app/lib/admin-session.ts';
import {createSignedValue} from '../app/lib/google-auth.ts';
import {GET,POST} from '../app/api/admin/public-cms-snapshot/route.ts';
const endpoint='https://vii.spaplus.co/api/admin/public-cms-snapshot';
const deps=db=>({authorized:async()=>true,database:async()=>db});
const exported=async f=>(await publicCmsSnapshotResponse(new Request(endpoint),deps(f.db))).text();

test('fixed one-statement snapshot returns all6 public model families without draft/actor/private data or writes',async()=>{
 const f=cmsFixture();try{
 populateCmsFixture(f);const before=f.sqlite.prepare('SELECT total_changes() AS n').get().n;
 const response=await publicCmsSnapshotResponse(new Request(endpoint),deps(f.db));assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('x-robots-tag'),/noindex/);assert.match(response.headers.get('content-disposition'),/attachment/);
 const text=await response.text(),result=verifyPublicCmsSnapshot(text);
 assert.deepEqual(Object.values(result.counts),[1,1,1,1,1,1]);assert.equal(result.records.length,6);
 assert.doesNotMatch(text,/PRIVATE_|DRAFT_SECRET|SOURCE_SECRET|CUSTOMER_SECRET/);
 assert.equal(result.integrityVerified,true);assert.equal(result.sourceConsistencyVerified,false);assert.equal(result.migrationVerified,false);
 assert.equal(f.queries.length,1);assert.equal(f.queries[0].sql,PUBLIC_CMS_SNAPSHOT_SQL);assert.equal(f.queries[0].args.length,1);
 assert.equal(f.sqlite.prepare('SELECT total_changes() AS n').get().n,before);
 }finally{f.sqlite.close();}
});
test('empty public source is explicit complete empty projection, not launch readiness',async()=>{
 const f=cmsFixture();try{const result=verifyPublicCmsSnapshot(await exported(f));assert.equal(result.records.length,0);assert.ok(Object.values(result.counts).every(n=>n===0));assert.equal(result.fullLaunchReady,false);}finally{f.sqlite.close();}
});
test('SQL row-size, aggregate byte and row-count limits return only control, never a truncated successful snapshot',async()=>{
 for(const mode of ['row-bytes','total-bytes','row-count']){
  const f=cmsFixture();try{
   if(mode==='row-count'){
    const insert=f.sqlite.prepare('INSERT INTO vii_redirects VALUES(?,?,?,?,?)');f.sqlite.exec('BEGIN');
    for(let n=0;n<20001;n++)insert.run('/old'+n,'/vacations/north',301,1,'PRIVATE_ACTOR');f.sqlite.exec('COMMIT');
   }else{
    const insert=f.sqlite.prepare('INSERT INTO vii_search_page_versions VALUES(?,?,?,?,?,?,?,?,?)');
    for(let n=0;n<(mode==='row-bytes'?1:7);n++)insert.run('v'+n,'/p'+n,'title','x'.repeat(mode==='row-bytes'?1900000:1850000),'published',null,1,'2020-01-01','PRIVATE_ACTOR');
   }
   const rows=f.sqlite.prepare(PUBLIC_CMS_SNAPSHOT_SQL).all(new Date().toISOString());assert.equal(rows.length,1);assert.equal(rows[0].family,'control');assert.equal(JSON.parse(rows[0].data).ok,0);
   const response=await publicCmsSnapshotResponse(new Request(endpoint),deps(f.db));assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'cms_snapshot_unavailable'});
  }finally{f.sqlite.close();}
 }
});
test('anonymous, forged identity, unsupported method/input/origin do not touch source DB',async()=>{
 let touches=0;const database=async()=>{touches++;throw Error('SECRET_DRIVER_ERROR');};
 for(const [request,status] of [[new Request(endpoint+'?table=private_customer_bookings'),400],[new Request(endpoint,{method:'POST'}),405],[new Request(endpoint,{headers:{Origin:'https://evil.example'}}),403]])
  assert.equal((await publicCmsSnapshotResponse(request,{authorized:async()=>true,database})).status,status);
 assert.equal((await publicCmsSnapshotResponse(new Request(endpoint),{authorized:async()=>false,database})).status,403);
 for(const request of [new Request(endpoint),new Request(endpoint,{headers:{'oai-authenticated-user-email':'owner@example.test','cf-access-authenticated-user-email':'owner@example.test'}})])assert.equal((await GET(request)).status,403);
 assert.equal((await POST(new Request(endpoint,{method:'POST'}))).status,403);assert.equal(touches,0);
});
test('existing signed admin boundary still denies visitor/expired, allows eligible owner only',async()=>{
 const previous=process.env.VII_AUTH_SECRET;process.env.VII_AUTH_SECRET='synthetic-cms-only-test-secret-32characters';const f=cmsFixture();
 try{
  populateCmsFixture(f);
  for(const [email,seconds,status] of [['visitor@example.test',60,403],['owner@example.test',-60,403],['owner@example.test',60,200]]){
   const token=await createSignedValue({sub:'synthetic',name:'Synthetic',email,provider:'google',exp:Math.floor(Date.now()/1000)+seconds});
   const request=new Request(endpoint,{headers:{Cookie:`vii_admin_session=${encodeURIComponent(token)}`}});
   const response=await publicCmsSnapshotResponse(request,{authorized:async r=>!!await authorizedAdminSession(r,['owner@example.test']),database:async()=>f.db});
   assert.equal(response.status,status);if(status===200)verifyPublicCmsSnapshot(await response.text());
  }
 }finally{f.sqlite.close();if(previous===undefined)delete process.env.VII_AUTH_SECRET;else process.env.VII_AUTH_SECRET=previous;}
});
test('truncated, edited, reordered, duplicate and malformed streams fail integrity verification',async()=>{
 const f=cmsFixture();try{
  populateCmsFixture(f);const text=await exported(f),lines=text.trimEnd().split('\n');
  for(const broken of [text.slice(0,-1),lines.slice(0,-1).join('\n')+'\n',text.replace('Public title','Changed title'),[lines[0],...lines.slice(1,-1).reverse(),lines.at(-1)].join('\n')+'\n',[lines[0],lines[1],...lines.slice(1)].join('\n')+'\n',text.replace('"migrationVerified":false','"migrationVerified":true')])assert.throws(()=>verifyPublicCmsSnapshot(broken));
 }finally{f.sqlite.close();}
});
test('source errors/malformed control are generic and never retried',async()=>{
 let calls=0;const response=await publicCmsSnapshotResponse(new Request(endpoint),{authorized:async()=>true,database:async()=>{calls++;throw Error('PRIVATE_SECRET');}});
 assert.equal(calls,1);assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'cms_snapshot_unavailable'});
 const db={prepare:()=>({bind:()=>({all:async()=>({success:true,results:[{family:'control',identity:'',data:'{"ok":1,"rowCount":1,"rawBytes":1}'}]})})})};
 assert.equal((await publicCmsSnapshotResponse(new Request(endpoint),deps(db))).status,503);
});
test('one actual WAL read does not mix geography and redirects when a second connection commits mid-query',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'vii-cms-snapshot-'));let f,writer;
 try{
  const file=join(directory,'source.sqlite');f=cmsFixture(file);populateCmsFixture(f);f.sqlite.exec('PRAGMA journal_mode=WAL; ALTER TABLE vii_geography_nodes RENAME TO raw_geo');writer=new DatabaseSync(file);
  let changed=false;f.sqlite.function('concurrent_title',{deterministic:false},title=>{if(!changed){changed=true;writer.exec("UPDATE vii_redirects SET target_path='/vacations/changed'");}return title;});
  f.sqlite.exec(`CREATE VIEW vii_geography_nodes AS SELECT node_key,level,supplier_id,parent_key,concurrent_title(supplier_title) AS supplier_title,supplier_title_en,title_override,title_en_override,slug,visible,featured,gps_lat,gps_long,unassigned,version,updated_by FROM raw_geo`);
  const result=verifyPublicCmsSnapshot(await exported(f));assert.equal(changed,true);
  assert.equal(writer.prepare('SELECT target_path FROM vii_redirects').get().target_path,'/vacations/changed');
  assert.equal(result.records.find(row=>row.family==='redirect').data.targetPath,'/vacations/north');
 }finally{writer?.close();f?.sqlite.close();rmSync(directory,{recursive:true,force:true});}
});
test('route preserves existing auth/DB boundary and has no schema/data/config writes',()=>{
 const route=readFileSync(new URL('../app/api/admin/public-cms-snapshot/route.ts',import.meta.url),'utf8');assert.match(route,/authorizedAdminSession/);assert.match(route,/publicCmsSnapshotResponse/);assert.doesNotMatch(route,/CREATE|ALTER|INSERT|UPDATE|DELETE|ensure|process\.env|Bearer|Secret/);
});
