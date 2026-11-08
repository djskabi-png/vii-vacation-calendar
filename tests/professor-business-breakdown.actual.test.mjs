import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createSourceLoader} from './helpers/source-module-loader.mjs';
import {parseProfessorIntent,professorNeedsInventory} from '../app/lib/admin-professor-intent.ts';
import {readProfessorBusinessBreakdown,coveredProfessorPeriod} from '../app/lib/professor-business-breakdown.ts';
import {professorPeriodBounds} from '../app/lib/professor-period-bounds.ts';
import {interpretProfessorQuestion} from '../app/lib/admin-professor-openai.ts';
const now=new Date('2026-11-08T12:00:00Z'),range={from:'2026-11-01',till:'2026-11-07',label:'fixture'};
const places=Array.from({length:9},(_,i)=>({placeId:`vacation-${i+1}`,siteID:i+1,name:`עסק ${i+1}`,world:'vacations'})).concat([{placeId:'event-1',siteID:1,name:'אירוע',world:'events'},{placeId:'spa-1',siteID:1,name:'ספא',world:'spa'}]);
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE vii_business_events(world TEXT,place_id TEXT,name TEXT,created_at TEXT,internal INTEGER,place_name TEXT);
 CREATE TABLE vii_booking_audit(world TEXT,place_id TEXT,created_at TEXT);
 CREATE TABLE vii_biz_conversion_coverage_v1(world TEXT,site_id INTEGER,from_day TEXT,till_day TEXT,saved_at TEXT);
 CREATE TABLE vii_biz_conversion_contacts_v1(world TEXT,site_id INTEGER,source TEXT,contact_day TEXT,order_id TEXT,order_price REAL);`);
 const db={prepare(text){let values=[];const statement={bind(...args){values=args;return statement;},async first(){return sql.prepare(text).get(...values)||null;},async all(){return {results:sql.prepare(text).all(...values)};},async run(){sql.prepare(text).run(...values);return {success:true};}};return statement;},async batch(statements){return Promise.all(statements.map(statement=>statement.run()));}};
 return {sql,db};
}
function populate(f){
 for(let day=1;day<=7;day++)f.sql.prepare('INSERT INTO vii_biz_conversion_coverage_v1 VALUES(?,?,?,?,?)').run('vacations',1,`2026-11-0${day}`,`2026-11-0${day}`,'2026-11-08T08:00:00Z');
 f.sql.exec(`INSERT INTO vii_biz_conversion_coverage_v1 VALUES('vacations',2,'2026-11-01','2026-11-07','2026-11-08T08:00:00Z'),('vacations',3,'2026-11-02','2026-11-07','2026-11-08T08:00:00Z'),('events',1,'2026-11-01','2026-11-07','2026-11-08T08:00:00Z');
 INSERT INTO vii_biz_conversion_contacts_v1 VALUES('vacations',1,'maskyoo','2026-11-03',NULL,NULL),('vacations',1,'maskyoo','2026-11-04',NULL,NULL),('vacations',3,'maskyoo','2026-11-03',NULL,NULL),('events',1,'maskyoo','2026-11-04',NULL,NULL);
 INSERT INTO vii_business_events VALUES('vacation','vacation-1','page_view','2026-11-01T10:00:00Z',0,'עסק1'),('vacation','vacation-1','page_view','2026-11-01T10:00:00Z',1,'עסק1'),('event','vacation-1','page_view','2026-11-01T10:00:00Z',0,'אירוע');`);
}
test('the exact monthly Maskyoo all-suppliers question requests per-business rows, not generic totals or top five',()=>{
 for(const question of ['כמות מסקיו שהיו החודש לכל הספקים','שיחות Maskyoo לפי עסק החודש']){const intent=parseProfessorIntent(question,places,now);assert.equal(intent.breakdown,true);assert.deepEqual(intent.metrics,['bizCalls']);assert.equal(intent.place,null);assert.equal(professorNeedsInventory(question),true);}
 assert.equal(parseProfessorIntent('סך הכל שיחות של כל הספקים ביחד',places,now).breakdown,false);
});
test('daily coverage joins continuously; missing days remain unknown rather than zero',()=>{
 const daily=Array.from({length:7},(_,i)=>({fromDay:`2026-11-0${i+1}`,tillDay:`2026-11-0${i+1}`}));assert.equal(coveredProfessorPeriod(daily,range.from,range.till),true);assert.equal(coveredProfessorPeriod(daily.filter((_,i)=>i!==3),range.from,range.till),false);
});
test('actual SQLite query returns every supplier with correct zero unknown and world identity',async()=>{
 const f=fixture();try{populate(f);const intent=parseProfessorIntent('כמות מסקיו שהיו החודש לכל הספקים',places,now),rows=await readProfessorBusinessBreakdown(f.db,f.db,range,range,intent,places);assert.equal(rows.length,11);assert.equal(rows.find(row=>row.placeId==='vacation-1').values.bizCalls,2);assert.equal(rows.find(row=>row.placeId==='vacation-2').values.bizCalls,0);assert.equal(rows.find(row=>row.placeId==='vacation-3').values.bizCalls,null);assert.equal(rows.find(row=>row.placeId==='event-1').values.bizCalls,1);assert.equal(rows.find(row=>row.placeId==='spa-1').values.bizCalls,null);}finally{f.sql.close();}
});
test('actual internal query excludes staff events and keeps composite event business identity',async()=>{
 const f=fixture();try{populate(f);const intent=parseProfessorIntent('כניסות החודש לכל הספקים',places,now),rows=await readProfessorBusinessBreakdown(f.db,f.db,range,null,intent,places);assert.equal(rows.find(row=>row.placeId==='vacation-1').values.pageViews,1);assert.equal(rows.find(row=>row.placeId==='event-1').values.pageViews,1);}finally{f.sql.close();}
});
test('actual answer engine preserves explicit month against a rewrite and unavailable results do not consume quota',async()=>{
 const f=fixture(),OriginalDate=globalThis.Date;
 class FixedDate extends OriginalDate{constructor(...args){super(...(args.length?args:[now.toISOString()]));}static now(){return now.getTime();}}
 globalThis.Date=FixedDate;
 try{
  populate(f);const load=createSourceLoader({'./public-catalog-read.ts':{publicCatalogSummaries:async world=>places.filter(place=>place.world===world).map(place=>({supplierId:place.siteID,name:place.name}))},'./admin-professor-openai.ts':{interpretProfessorQuestion:async()=>({canonicalQuestion:'כמה שיחות היו היום',provider:'openai'})}});
  const {answerProfessor,professorQuota}=load('app/lib/admin-professor.ts');
  const answer=await answerProfessor(f.db,'fixture@example.test','כמות מסקיו שהיו החודש לכל הספקים');
  assert.equal(answer.range.from,'2026-11-01');assert.equal(answer.businessRows.length,11);assert.equal(answer.metrics.bizCalls,3);assert.equal(answer.dataStatus,'partial');assert.equal(answer.freshness.bizRange.till,'2026-11-07');assert.equal((await professorQuota(f.db,'fixture@example.test')).used,1);
  f.sql.exec('DELETE FROM vii_biz_conversion_coverage_v1');const missing=await answerProfessor(f.db,'fixture@example.test','כמות מסקיו שהיו החודש לכל הספקים');assert.equal(missing.dataStatus,'unavailable');assert.equal(missing.metrics.bizCalls,null);assert.equal((await professorQuota(f.db,'fixture@example.test')).used,1);
 }finally{globalThis.Date=OriginalDate;f.sql.close();}
});
test('an unambiguous all-supplier report bypasses remote model latency',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>assert.fail('Remote model must not be called');try{const answer=await interpretProfessorQuestion('כמות מסקיו שהיו החודש לכל הספקים');assert.equal(answer.provider,'deterministic');}finally{globalThis.fetch=original;}
});
test('Israel calendar report bounds respect the DST transition and exclude following midnight',()=>{
 assert.deepEqual(professorPeriodBounds('2026-11-01','2026-11-08'),{since:'2026-10-31T22:00:00.000Z',until:'2026-11-08T22:00:00.000Z'});
 const dst=professorPeriodBounds('2026-03-27','2026-03-27');assert.equal((Date.parse(dst.until)-Date.parse(dst.since))/3600000,23);
});
test('the actual table window stays bounded while preserving all searchable business rows',()=>{
 const {professorBusinessWindow}=createSourceLoader()('app/admin/professor/business-table.tsx');const rows=Array.from({length:921},(_,i)=>({name:`Business${i}`,placeId:`vacation-${i}`,values:{bizCalls:null}}));assert.equal(professorBusinessWindow(rows,'',0).items.length,20);assert.equal(professorBusinessWindow(rows,'',46).items.length,1);assert.equal(professorBusinessWindow(rows,'Business920',0).items[0].placeId,'vacation-920');assert.equal(professorBusinessWindow(rows,'',999).total,921);
});
