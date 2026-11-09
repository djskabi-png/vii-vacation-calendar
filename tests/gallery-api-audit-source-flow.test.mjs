import assert from 'node:assert/strict';
import test from 'node:test';
import {createGalleryAuditJob,stepGalleryAuditJob,readGalleryAuditItem} from '../app/lib/gallery-api-audit-job.ts';
import {createSergeyPublicCatalogClient} from '../app/lib/sergey-public-catalog-client.ts';

class Bucket {
  objects=new Map(); revision=0;
  async get(key){const value=this.objects.get(key);return value?{etag:value.etag,text:async()=>value.text}:null;}
  async put(key,text,options={}){const old=this.objects.get(key);if(options.onlyIf?.etagDoesNotMatch==='*'&&old)return null;if(options.onlyIf?.etagMatches&&old?.etag!==options.onlyIf.etagMatches)return null;const value={text:String(text),etag:String(++this.revision)};this.objects.set(key,value);return {etag:value.etag};}
}
const ids={vacations:17,events:18,rooms:19,spa:20};
const locations={cities:[{id:1,title:'חיפה',area:2}],areas:[{id:2,title:'חיפה והקריות'}]};
const types={roomTypes:[],amenity_categories:[],amenities:[]};
const raw=id=>({id,active:true,api_version:1.1,created:new Date().toISOString(),name:'מקום בדיקה',location:{city:1},summary:'תיאור המקום',shared_amenities:[],
  galleries:{'9':{galleryID:9,title:'כללי',pictures:['/gallery/place.jpg']}},
  rooms:[{roomID:55,roomName:'יחידה',roomCount:1,maxGuests:2,amenities:[],spaces:[],galleries:[{galleryID:2,title:'יחידה',pictures:['/gallery/unit.jpg']}]}]});
const listing=id=>({places:[{siteID:id,siteName:'מקום בדיקה',active:true,rooms:[{roomID:55}],galleries:[{galleryID:9,title:'כללי',pictures:['/gallery/place.jpg']}]}]});
const response=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});

test('actual resumable job matches complete nonempty place AND unit through the real normalizer',async()=>{
  const bodies={vacations:raw(17),events:raw(18)};const calls=[];
  const fetchImpl=async input=>{const url=new URL(input);const path=url.pathname.replace('/api/ai/vii','');calls.push(url.hostname+path);
    if(url.hostname==='www.spaplus.co.il')return response({status:'ok',sites:{'20':{siteid:20,title:'ספא'}}});
    if(path==='/locations'||path==='/rooms/locations')return response(locations);
    if(path.endsWith('/types'))return response(types);
    for(const world of ['vacations','events','rooms'])if(path===`/${world}`)return response(listing(ids[world]));
    if(path==='/vacations/17')return response(bodies.vacations);
    if(path==='/events/18')return response(bodies.events);
    throw Error('unexpected_fixture_endpoint:'+path);
  };
  const accepted=(await createSergeyPublicCatalogClient({apiKey:'fixture',fetchImpl}).fetchCandidate('vacations')).entries[0];
  calls.length=0;
  const db={prepare(sql){return {bind(...args){return {async first(){if(sql.includes('JOIN supplier_catalog_entries'))return {summaryJson:JSON.stringify(accepted.summary),detailJson:JSON.stringify(accepted.detail),acceptedAt:new Date().toISOString()};const world=args[0];return {activeRunId:'run-'+world,activeCount:1};},async all(){return {results:[{supplierId:ids[args[1]]}]};}};}};}};
  const bucket=new Bucket(),jobId='11111111-1111-4111-8111-111111111111';
  await createGalleryAuditJob({db,bucket,jobId});
  const outcomes=await Promise.allSettled([stepGalleryAuditJob({db,bucket,jobId,batchSize:1,env:{SERGEY_VII_API_TOKEN:'fixture',SPAPLUS_VII_API_KEY:'fixture'},fetchImpl}),stepGalleryAuditJob({db,bucket,jobId,batchSize:1,env:{SERGEY_VII_API_TOKEN:'fixture',SPAPLUS_VII_API_KEY:'fixture'},fetchImpl})]);
  const completed=outcomes.find(x=>x.status==='fulfilled');const conflict=outcomes.find(x=>x.status==='rejected');
  assert.ok(completed);assert.match(conflict.reason.message,/audit_step_in_progress/);
  assert.equal(completed.value.completed,1);
  const item=await readGalleryAuditItem(bucket,jobId,'vacations',17);
  assert.equal(item.finding.status,'match',JSON.stringify(item.finding.issues));
  assert.equal(item.api.entities.length,2);
  assert.deepEqual(item.api.entities.map(x=>x.imageIds),[['place.jpg'],['unit.jpg']]);
  assert.ok(item.finding.sha256.match(/^[a-f0-9]{64}$/));
  assert.ok(bucket.objects.has(item.rawKey));
  assert.equal(calls.filter(x=>x.endsWith('/vacations/17')).length,1);
  assert.equal(calls.filter(x=>x.startsWith('www.spaplus.co.il')).length,1);
  assert.equal(completed.value.matched,1);
});
