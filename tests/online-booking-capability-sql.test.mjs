import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {readObservedOnlineCapabilities,observedOnlineCapabilities} from '../app/lib/online-booking-capability-cache.ts';
import {CAPABILITY_MAX_AGE_MS} from '../app/lib/online-booking-capability.ts';
const now=Date.parse('2026-11-05T12:00:00Z');
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE vii_discovery_offer_cache_v1(cache_key TEXT PRIMARY KEY,payload TEXT,checked_at INTEGER)');
 let cursor=0;const returned=[];
 return {sql,returned,put(payload,time=now-++cursor*1000){sql.prepare('INSERT INTO vii_discovery_offer_cache_v1 VALUES(?,?,?)').run('row'+(++cursor),typeof payload==='string'?payload:JSON.stringify(payload),time);},
 db:{prepare(query){return{bind(...args){return{async all(){const results=sql.prepare(query).all(...args);returned.push(...results);return{results};}};}};}},
 expected(){const selected=sql.prepare(`SELECT payload,checked_at FROM vii_discovery_offer_cache_v1 WHERE payload IS NOT NULL AND checked_at >= ? AND payload LIKE '%"onlineBooking":true%' ORDER BY checked_at DESC LIMIT 128`).all(now-CAPABILITY_MAX_AGE_MS);return observedOnlineCapabilities(selected,now);}};
}
test('actual SQLite projection preserves strict flags, safe numeric IDs, shapes, malformed JSON and latest valid timestamps',async()=>{
 const f=fixture();try{
 f.put({deals:[{siteID:12,onlineBooking:true},{siteID:'13',onlineBooking:true},{siteID:14,onlineBooking:1},{siteID:15,onlineBooking:'true'},{siteID:16,onlineBooking:false},'text',7,null,[],{siteID:0,onlineBooking:true},{siteID:9007199254740992,onlineBooking:true},{siteID:17.5,onlineBooking:true}]});
 f.put({results:[{siteID:12,onlineBooking:true},{siteID:18,onlineBooking:true}]},now-100);
 f.put('{"deals":[{"siteID":19.0,"onlineBooking":true},{"siteID":20e0,"onlineBooking":true}]}',now-200);
 f.put('{"onlineBooking":true,');
 f.put({deals:'not array',results:[{siteID:21,onlineBooking:true}]});
 f.put({deals:[{siteID:22,onlineBooking:true}]},now+1);
 f.put({deals:[{siteID:23,onlineBooking:true}]},now-CAPABILITY_MAX_AGE_MS);
 f.put({deals:[{siteID:24,onlineBooking:true}]},now-CAPABILITY_MAX_AGE_MS-1);
 f.put({deals:[{siteID:25,onlineBooking:true}]},now-0.5);
 const actual=await readObservedOnlineCapabilities(f.db,now);assert.deepEqual(actual,f.expected());assert.deepEqual(Object.keys(actual).sort(),['vacation-12','vacation-18','vacation-19','vacation-20','vacation-21']);
 assert.equal(actual['vacation-12'].checkedAt,now-100);assert.ok(f.returned.every(row=>Object.keys(row).sort().join(',')==='checkedAt,siteID'));
 }finally{f.sql.close();}
});
test('128-source-row boundary applies before expanding both arrays and deduplicating, without returning source bodies',async()=>{
 const f=fixture();try{
 for(let i=0;i<130;i++)f.put({deals:[{siteID:1000+i,onlineBooking:true},{siteID:1,onlineBooking:true}],results:[{siteID:1,onlineBooking:true}],unneeded:'x'.repeat(10_000)},now-130+i);
 const result=await readObservedOnlineCapabilities(f.db,now);assert.deepEqual(result,f.expected());assert.equal(result['vacation-1000'],undefined);assert.equal(result['vacation-1001'],undefined);assert.equal(Object.keys(result).length,129);
 assert.equal(f.returned.length,129);assert.ok(JSON.stringify(f.returned).length<10_000);assert.ok(f.returned.every(row=>!Object.hasOwn(row,'payload')));
 }finally{f.sql.close();}
});
