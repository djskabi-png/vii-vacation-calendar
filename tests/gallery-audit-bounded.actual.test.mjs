import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { runSupplierCatalogSync } from "../app/lib/supplier-catalog-sync.ts";
import { startBoundedGalleryApply, stepBoundedGalleryApply, readBoundedGalleryApply, recoverBoundedGalleryApply, continueBoundedGalleryApply, galleryNonMediaFactsMatch } from "../app/lib/gallery-audit-bounded-apply.ts";
import { finishSupplierCatalogRun } from "../app/lib/supplier-catalog-store.ts";
import { reviewableGallerySourceFailure } from "../app/lib/gallery-source-media-failure.ts";
import { buildAcceptedGalleryContract, buildApiGalleryContract, parseOrderedJson, compareGalleryContracts } from "../app/lib/supplier-gallery-contract.ts";
import { normalizeSpaPlusCatalog } from "../app/lib/spaplus-catalog-client.ts";
import { proveSupplierMediaDetail } from "../app/lib/supplier-detail-contract.ts";

async function applyGalleryAuditWorld(input) {
 const existing=await readBoundedGalleryApply(input.bucket,input.jobId,input.world);
 if(existing?.phase==='complete'||existing?.phase==='error')return existing;
 let state=await startBoundedGalleryApply(input);
 let steps=0; const baseline=(await input.db.prepare('SELECT active_run_id FROM supplier_catalog_state WHERE world=?').bind(input.world).first()).active_run_id;
 while(state.phase!=='complete'&&state.phase!=='error'&&steps++<100){
  const before=state;
  state=await stepBoundedGalleryApply(input);
  if(before.phase==='prepare'&&state.phase!=='error')assert.equal(state.cursor,before.cursor+1,'one supplier per request');
  if(state.phase==='prepare'||state.phase==='accept')assert.equal((await input.db.prepare('SELECT active_run_id FROM supplier_catalog_state WHERE world=?').bind(input.world).first()).active_run_id,baseline,'incomplete generation remains invisible');
  if(before.phase==='verify')assert.ok(state.verifyCursor-before.verifyCursor<=4);
 }
 assert.ok(steps<100,JSON.stringify(state));
 return state;
}
const jobId = "77777777-7777-4777-8777-777777777777";
const prefix = `vii-gallery-audit/v1/${jobId}/`;
const now = new Date();

class FakeR2 {
  constructor(initial = {}) { this.objects = new Map(Object.entries(initial).map(([key, value]) => [key, { value, etag: `seed-${key}`, contentType: "application/json" }])); this.writes = []; this.headCalls = []; }
  async head(key) { this.headCalls.push(key); const object = this.objects.get(key); return object ? { etag: object.etag, size: typeof object.value === "string" ? new TextEncoder().encode(object.value).length : object.value.byteLength, httpMetadata: { contentType: object.contentType } } : null; }
  async get(key) { const object = this.objects.get(key); return object ? { etag: object.etag, size: typeof object.value === "string" ? new TextEncoder().encode(object.value).length : object.value.byteLength, httpMetadata: { contentType: object.contentType }, body: typeof object.value === "string" ? new Response(object.value).body : new Response(object.value).body, async text() { return typeof object.value === "string" ? object.value : new TextDecoder().decode(object.value); } } : null; }
  async put(key, value, options = {}) {
    const prior = this.objects.get(key);
    if (options.onlyIf?.etagDoesNotMatch === "*" && prior) return null;
    if (options.onlyIf?.etagMatches && (!prior || prior.etag !== options.onlyIf.etagMatches)) return null;
    const etag = `etag-${this.writes.length + 1}`;
    this.objects.set(key, { value, etag, contentType: options.httpMetadata?.contentType || "application/json" }); this.writes.push({ key, value, options }); return { etag };
  }
}

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const name of ["0000_groovy_boomerang", "0001_brief_pixie", "0002_sour_tigra", "0003_catalog_diagnostics", "0013_adorable_moira_mactaggert"]) {
    const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
    for (const sql of source.split("--> statement-breakpoint").map(part => part.trim()).filter(Boolean)) sqlite.exec(sql);
  }
  const prepare = sql => { let values = []; return { bind(...args) { values = args; return this; }, async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; };
  return { prepare, async batch(statements) { sqlite.exec("BEGIN"); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } }, close() { sqlite.close(); } };
}


async function runPrefetchCase(tamper=''){
 const db=await database(), baseline=[], normalized=[], findings=[], objects={};const savedFetch=globalThis.fetch;let failedSourceReads=0;
 if(tamper==='badSourceType')globalThis.fetch=async url=>{assert.equal(String(url),'https://www.vii.co.il/gallery/new-source.jpg');failedSourceReads++;return new Response('<html>missing supplier image</html>',{headers:{'Content-Type':'text/html'}});};
 const hash=async wire=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(wire)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 for(let i=1;i<=9;i++){
  const old={supplierId:i,summary:{name:'Place '+i,price:420,features:['Pool'],images:['/gallery/same.jpg']},detail:{price:420,features:['Pool'],images:['/gallery/same.jpg'],galleryGroups:[{id:'old',images:['/gallery/same.jpg']}],rooms:[{id:i*100,name:'Unit '+i,images:['/gallery/same.jpg'],galleryGroups:[{id:'old-room',images:['/gallery/same.jpg']}]}]}};
  if(tamper==='empty'||tamper==='emptyErase')old.detail.rooms.push({id:i*100+1,name:'Empty owner',images:tamper==='emptyErase'?['/gallery/same.jpg']:[],galleryGroups:[]});
  const next=structuredClone(old);next.detail.galleryGroups[0].id='9';next.detail.rooms[0].galleryGroups[0].id='2';baseline.push(old);normalized.push(next);
  const apiUnitImage=tamper==='badSourceType'&&i===1?'/gallery/new-source.jpg':'/gallery/same.jpg';next.detail.rooms[0].images=[apiUnitImage];next.detail.rooms[0].galleryGroups[0].images=[apiUnitImage];
  if(tamper==='emptyPlace'){old.summary.images=[];old.detail.images=[];old.detail.galleryGroups=[];}
  if(tamper==='extraEmpty'||tamper==='extraNonempty')next.detail.rooms.push({id:i*100+1,name:'Unaccepted API owner',images:tamper==='extraNonempty'?['/gallery/same.jpg']:[],galleryGroups:tamper==='extraNonempty'?[{id:'3',images:['/gallery/same.jpg']}]:[]});
  const raw={api_version:1.1,created:now.toISOString(),id:i,active:true,galleries:{9:{galleryID:9,title:String(123),pictures:['/gallery/same.jpg']}},rooms:[{roomID:i*100,galleries:[{galleryID:2,title:String(456),pictures:[apiUnitImage]}]}]};if(tamper==='empty'||tamper==='emptyErase'){raw.rooms.push({roomID:i*100+1,galleries:[]});next.detail.rooms[1].images=[];}if(tamper==='extraEmpty'||tamper==='extraNonempty')raw.rooms.push({roomID:i*100+1,galleries:tamper==='extraNonempty'?[{galleryID:3,title:'New',pictures:['/gallery/same.jpg']}]:[]});const wire=JSON.stringify(raw);
  const finding={world:'vacations',supplierId:i,status:'mismatch',issues:[],recordKey:prefix+'items/vacations-'+i+'.json',sha256:await hash(wire)};findings.push(finding);
  objects[prefix+'raw/vacations-'+i+'.json']=wire;
  objects[finding.recordKey]=JSON.stringify({finding,api:await buildApiGalleryContract('vacations',i,raw,wire),normalized:next,acceptedContract:await buildAcceptedGalleryContract('vacations',old),normalizedContract:await buildAcceptedGalleryContract('vacations',next),fetchedAt:now.toISOString(),rawKey:prefix+'raw/vacations-'+i+'.json'});
  if(tamper==='alreadyRepaired'){baseline[baseline.length-1]=structuredClone(next);baseline[baseline.length-1].detail.price=777;baseline[baseline.length-1].summary.price=777;}
  if(tamper==='changedBaseline'){baseline[baseline.length-1]=structuredClone(old);baseline[baseline.length-1].detail.galleryGroups[0].id='concurrent-source';}
 }
 objects[prefix+'context/vacations.json']=JSON.stringify({places:normalized.map(x=>({siteID:x.supplierId,active:true,rooms:x.detail.rooms.map(room=>({roomID:room.id}))}))});
 objects[prefix+'job.json']=JSON.stringify({jobId,state:'complete',total:9,cursor:9,results:findings,deadline:new Date(now.getTime()+3600000).toISOString(),sourceIssues:[],worldCounts:{vacations:9,events:0,rooms:0,spa:0}});
 if(tamper==='hash')objects[prefix+'raw/vacations-1.json']+=' ';
 if(tamper==='foreign'){const item=JSON.parse(objects[prefix+'items/vacations-1.json']);item.rawKey='another-job/private.json';objects[prefix+'items/vacations-1.json']=JSON.stringify(item);}
 const bucket=new FakeR2(objects),get=bucket.get.bind(bucket);let inflight=0,max=0;const readKeys=[];bucket.get=async key=>{readKeys.push(key);const bounded=key.includes('/items/')||key.includes('/raw/');if(!bounded)return get(key);inflight++;max=Math.max(max,inflight);try{await new Promise(r=>setImmediate(r));return await get(key);}finally{inflight--;}};
 try{
  assert.equal((await runSupplierCatalogSync(db,{id:'prefetch-seed',world:'vacations',source:'test',baseline,now:()=>now,fetchCandidate:async()=>({fetchedAt:now.toISOString(),entries:baseline})})).status,'accepted');
  if(tamper==='recoverFacts'||tamper==='recoverWrongPrefix'){
   const input={db,bucket,jobId,world:'vacations'};await startBoundedGalleryApply(input);await stepBoundedGalleryApply(input);let state=await stepBoundedGalleryApply(input);assert.equal(state.cursor,1);
   await finishSupplierCatalogRun(db,{id:state.runId,world:'vacations',status:'failed',errorCode:'gallery_nonmedia_facts_changed',finishedAt:new Date().toISOString()});state.state='not_accepted';state.phase='error';state.errorCode='gallery_nonmedia_facts_changed';
   if(tamper==='recoverWrongPrefix')state.cursor=2;
   await bucket.put(prefix+'apply/vacations.bounded.json',JSON.stringify(state));
   if(tamper==='recoverWrongPrefix'){await assert.rejects(recoverBoundedGalleryApply(input),/gallery_facts_recovery_requires_review/);assert.equal((await db.prepare('SELECT active_run_id FROM supplier_catalog_state WHERE world=?').bind('vacations').first()).active_run_id,'prefetch-seed');return;}
   state=await recoverBoundedGalleryApply(input);assert.equal(state.cursor,1);assert.equal(state.changed,1);assert.equal(state.phase,'prepare');await assert.rejects(recoverBoundedGalleryApply(input),/gallery_facts_recovery_requires_review/);
  }
  const receipt=await applyGalleryAuditWorld({db,bucket,jobId,world:'vacations'});
  if(tamper==='badSourceType'){assert.equal(receipt.state,'accepted');assert.equal(receipt.changed,8);assert.equal(receipt.verified,8);assert.equal(receipt.skipped,1);assert.equal(failedSourceReads,1);assert.ok(receipt.sourceWarnings[0].issues.includes('unverified_source_media:archive_image_type_invalid'));assert.ok(receipt.sourceWarnings[0].issues.includes('unverified_candidate_media:new-source.jpg'));assert.ok(!bucket.writes.some(x=>x.key==='legacy-gallery/v1/new-source.jpg'));const rows=(await db.prepare('SELECT supplier_id,detail_json FROM supplier_catalog_entries WHERE run_id=? ORDER BY supplier_id').bind(receipt.runId).all()).results;assert.equal(JSON.parse(rows[0].detail_json).galleryGroups[0].id,'old');assert.equal(JSON.parse(rows[1].detail_json).galleryGroups[0].id,'9');return;}
  if(tamper==='hash'||tamper==='foreign'){assert.equal(receipt.state,'not_accepted',JSON.stringify(receipt));assert.equal(receipt.verified,0);assert.ok(!readKeys.includes('another-job/private.json'));const current=await db.prepare('SELECT active_run_id FROM supplier_catalog_state WHERE world = ?').bind('vacations').first();assert.equal(current.active_run_id,'prefetch-seed');return;}
  if(tamper==='emptyErase'){assert.equal(receipt.verified,0);assert.equal(receipt.skipped,9);const rows=(await db.prepare('SELECT detail_json FROM supplier_catalog_entries WHERE run_id = ?').bind(receipt.runId).all()).results;assert.equal(rows.length,9);for(const row of rows)assert.deepEqual(JSON.parse(row.detail_json).rooms[1].images,['/gallery/same.jpg']);return;}
  if(tamper==='extraNonempty'){assert.equal(receipt.verified,0);assert.equal(receipt.skipped,9);return;}
  if(tamper==='alreadyRepaired'){assert.equal(receipt.verified,9);assert.equal(receipt.changed,0);const rows=(await db.prepare('SELECT detail_json FROM supplier_catalog_entries WHERE run_id = ?').bind(receipt.runId).all()).results;for(const row of rows)assert.equal(JSON.parse(row.detail_json).price,777);return;}
  if(tamper==='changedBaseline'){assert.equal(receipt.verified,0);assert.equal(receipt.skipped,9);assert.equal(receipt.sourceWarnings.length,9);const rows=(await db.prepare('SELECT detail_json FROM supplier_catalog_entries WHERE run_id = ?').bind(receipt.runId).all()).results;for(const row of rows)assert.equal(JSON.parse(row.detail_json).galleryGroups[0].id,'concurrent-source');return;}
  if(tamper==='empty')assert.equal(receipt.sourceWarnings.length,9);
  if(tamper==='extraEmpty')assert.equal(receipt.sourceWarnings.filter(x=>x.issues.some(i=>i.startsWith('unverified_unpublished_empty_api_owner:'))).length,9);
  assert.equal(receipt.state,'accepted',JSON.stringify(receipt));assert.equal(receipt.verified,9);assert.equal(receipt.changed,9);assert.equal(receipt.skipped,0);assert.equal(max,1);
  const rows=(await db.prepare('SELECT summary_json,detail_json FROM supplier_catalog_entries WHERE run_id = ?').bind(receipt.runId).all()).results;assert.equal(rows.length,9);for(const row of rows){const d=JSON.parse(row.detail_json),s=JSON.parse(row.summary_json);assert.equal(d.price,420);assert.deepEqual(d.features,['Pool']);assert.match(d.rooms[0].name,/^Unit /);assert.equal(d.galleryGroups[0].id,'9');assert.equal(s.price,420);}
  const writes=bucket.writes.length;assert.deepEqual(await applyGalleryAuditWorld({db,bucket,jobId,world:'vacations'}),receipt);assert.equal(bucket.writes.length,writes);
 }finally{globalThis.fetch=savedFetch;db.close();}
}
test('actual resumable nine-entry apply advances one supplier and preserves every nonmedia fact',()=>runPrefetchCase());
test('prefetched corrupt source bytes keep the previous public generation',()=>runPrefetchCase('hash'));
test('prefetch rejects a foreign raw key before reading it or changing the generation',()=>runPrefetchCase('foreign'));
test('already empty API owners remain warnings while healthy gallery order is repaired',()=>runPrefetchCase('empty'));
test('an empty API owner cannot erase last-good accepted photos',()=>runPrefetchCase('emptyErase'));
test('new empty API units remain unpublished while existing owner galleries are repaired',()=>runPrefetchCase('extraEmpty'));
test('a new API owner with photos blocks a partial owner-set patch',()=>runPrefetchCase('extraNonempty'));
test('API photos can fill an empty gallery belonging to an existing business',()=>runPrefetchCase('emptyPlace'));
test('a concurrent sync which already matches the API keeps all newer accepted facts',()=>runPrefetchCase('alreadyRepaired'));
test('a different concurrent media change remains untouched and explicitly unverified',()=>runPrefetchCase('changedBaseline'));
test('a known false-positive facts failure resumes after its exact staged prefix without repeating counters',()=>runPrefetchCase('recoverFacts'));
test('facts recovery cannot accept an unverified staged-prefix cursor',()=>runPrefetchCase('recoverWrongPrefix'));
test('one API image returning HTML preserves that supplier and still repairs eight healthy suppliers',()=>runPrefetchCase('badSourceType'));
test('only upstream file failures can preserve last-good data; internal archive and ownership corruption still block',()=>{
 for(const code of ['archive_image_type_invalid','archive_image_magic_invalid','archive_source_http_404','archive_source_http_410'])assert.equal(reviewableGallerySourceFailure(code),true,code);
 for(const code of ['archive_existing_invalid','archive_existing_checksum_mismatch','archive_conditional_race_invalid','gallery_source_checksum_changed','foreign_gallery_supplier','gallery_nonmedia_facts_changed','archive_source_http_500','gallery_apply_step_failed'])assert.equal(reviewableGallerySourceFailure(code),false,code);
});

test('actual hourly summary galleries change while names, prices, features and room identities remain intact',async()=>{
 const db=await database(),world='rooms',current={supplierId:1,summary:{name:'Hourly owner',price:200,features:['Pool'],image:'/gallery/same.jpg',images:['/gallery/same.jpg'],galleryGroups:[{id:'old',images:['/gallery/same.jpg']}],rooms:[{id:100,name:'Private room',price:220,features:['Bath'],image:'/gallery/same.jpg',images:['/gallery/same.jpg'],galleryGroups:[{id:'old-room',images:['/gallery/same.jpg']}]}]}};
 const normalized=structuredClone(current);normalized.summary.galleryGroups[0].id='9';normalized.summary.rooms[0].galleryGroups[0].id='2';
 const raw={galleries:{9:{galleryID:9,pictures:['/gallery/same.jpg']}},rooms:[{roomID:100,galleries:[{galleryID:2,pictures:['/gallery/same.jpg']}]}]},wire=JSON.stringify(raw),finding={world,supplierId:1,status:'mismatch',recordKey:prefix+'items/rooms-1.json'};
 const bucket=new FakeR2({[prefix+'job.json']:JSON.stringify({jobId,state:'complete',total:1,cursor:1,results:[finding],deadline:new Date(Date.now()+3600000).toISOString(),sourceIssues:[],worldCounts:{vacations:0,events:0,rooms:1,spa:0}}),[finding.recordKey]:JSON.stringify({finding,api:await buildApiGalleryContract(world,1,raw,wire),normalized,acceptedContract:await buildAcceptedGalleryContract(world,current),normalizedContract:await buildAcceptedGalleryContract(world,normalized),fetchedAt:new Date().toISOString()})});
 try{assert.equal((await runSupplierCatalogSync(db,{id:'hourly-facts-seed',world,source:'test',baseline:[current],fetchCandidate:async()=>({fetchedAt:new Date().toISOString(),entries:[current]})})).status,'accepted');
  const receipt=await applyGalleryAuditWorld({db,bucket,jobId,world});assert.equal(receipt.state,'accepted',JSON.stringify(receipt));assert.equal(receipt.verified,1);assert.equal(receipt.changed,1);
  const saved=JSON.parse((await db.prepare('SELECT summary_json FROM supplier_catalog_entries WHERE run_id=?').bind(receipt.runId).first()).summary_json);assert.equal(saved.galleryGroups[0].id,'9');assert.equal(saved.rooms[0].galleryGroups[0].id,'2');assert.equal(saved.rooms[0].price,220);assert.deepEqual(saved.rooms[0].features,['Bath']);assert.equal(saved.price,200);
 }finally{db.close();}
});
test('four world-specific media shapes are excluded from fact equality while business facts still block changes',()=>{
 for(const world of ['vacations','events','rooms','spa']){
  const current={supplierId:1,summary:{name:'Owner',price:123,images:['old'],gallery:['old'],galleryGroups:[{id:'old'}],rooms:[{id:1,name:'Room',price:234,images:['old'],galleryGroups:[{id:'old'}]}],packages:[{id:1,title:'Pack',price:345,image:'old',gallery:['old']}]},detail:{images:['old'],galleryGroups:[{id:'old'}],rooms:[{id:1,name:'Room',price:456,images:['old'],galleryGroups:[{id:'old'}]}]}};
  const next=structuredClone(current);next.summary.images=['new'];next.summary.gallery=['new'];next.summary.galleryGroups=[{id:'new'}];next.summary.rooms[0].images=['new'];next.summary.rooms[0].galleryGroups=[{id:'new'}];next.summary.packages[0].image='new';next.summary.packages[0].gallery=['new'];next.detail.images=['new'];next.detail.rooms[0].images=['new'];assert.equal(galleryNonMediaFactsMatch(world,next,current),true,world);
  for(const change of [x=>x.summary.price++,x=>x.summary.rooms[0].name='Foreign',x=>x.summary.packages[0].price++,x=>x.detail.rooms[0].id=2]){const bad=structuredClone(next);change(bad);assert.equal(galleryNonMediaFactsMatch(world,bad,current),false,world);}
 }
});
test('a known quarantined SPA image remains an explicit warning while healthy package order is repaired',async()=>{
 const db=await database(),world='spa',bad='https://www.spaplus.co.il/gallery/1773307880052130.jpeg';
 const wire=`{"status":"ok","sites":{"42":{"siteid":42,"title":"Spa","city":"Haifa","spa_picture":"https://www.spaplus.co.il/gallery/site.jpg","gallery":["https://www.spaplus.co.il/gallery/site.jpg"],"packages":{"7":{"MainPageID":7,"idPack":70,"MainPageTitle":"Seven","price":700,"pack_picture":"${bad}"},"3":{"MainPageID":3,"idPack":30,"MainPageTitle":"Three","price":300,"pack_picture":"https://www.spaplus.co.il/gallery/three.jpg"}}}}}`;
 const raw=parseOrderedJson(wire),normalized=normalizeSpaPlusCatalog(raw)[0],baseline=structuredClone(normalized);baseline.summary.packages.reverse();baseline.summary.packages.find(x=>x.id===7).image=bad;
 const finding={world,supplierId:42,status:'unverified',recordKey:prefix+'items/spa-42.json'};
 const bucket=new FakeR2({[prefix+'job.json']:JSON.stringify({jobId,state:'complete',total:1,cursor:1,results:[finding],deadline:new Date(Date.now()+3600000).toISOString(),sourceIssues:[],worldCounts:{vacations:0,events:0,rooms:0,spa:1}}),[finding.recordKey]:JSON.stringify({finding,api:await buildApiGalleryContract(world,42,raw.sites['42'],wire),normalized,acceptedContract:await buildAcceptedGalleryContract(world,baseline),normalizedContract:await buildAcceptedGalleryContract(world,normalized),fetchedAt:new Date().toISOString()})});
 try{assert.equal((await runSupplierCatalogSync(db,{id:'spa-quarantine-seed',world,source:'test',baseline:[baseline],fetchCandidate:async()=>({fetchedAt:new Date().toISOString(),entries:[baseline]})})).status,'accepted');const receipt=await applyGalleryAuditWorld({db,bucket,jobId,world});assert.equal(receipt.state,'accepted',JSON.stringify(receipt));assert.equal(receipt.verified,1);assert.equal(receipt.skipped,0);assert.ok(receipt.sourceWarnings.some(x=>x.issues.some(i=>i.includes('1773307880052130.jpeg'))));
  const summary=JSON.parse((await db.prepare('SELECT summary_json FROM supplier_catalog_entries WHERE run_id=?').bind(receipt.runId).first()).summary_json);assert.deepEqual(summary.packages.map(x=>x.id),[7,3]);assert.equal(summary.packages[0].image,null);assert.equal(summary.packages[0].price,700);
 }finally{db.close();}
});
test('actual SPA generation repairs API package-owner order without changing prices or titles',async()=>{
 const db=await database(),wire='{"status":"ok","sites":{"42":{"siteid":42,"title":"Spa","city":"Haifa","spa_picture":"https://www.spaplus.co.il/gallery/site.jpg","gallery":["https://www.spaplus.co.il/gallery/site.jpg"],"packages":{"7":{"MainPageID":7,"idPack":70,"MainPageTitle":"Seven","price":700,"pack_picture":"https://www.spaplus.co.il/gallery/seven.jpg"},"3":{"MainPageID":3,"idPack":30,"MainPageTitle":"Three","price":300,"pack_picture":"https://www.spaplus.co.il/gallery/three.jpg"}}}}}';
 const raw=parseOrderedJson(wire),normalized=normalizeSpaPlusCatalog(raw)[0],baseline=structuredClone(normalized);baseline.summary.packages.reverse();baseline.summary.packages[0].price=333;baseline.summary.packages[1].price=777;baseline.summary.packages[0].image='https://www.spaplus.co.il/gallery/old-package-image.jpg';
 const api=await buildApiGalleryContract('spa',42,raw.sites['42'],wire),finding={world:'spa',supplierId:42,status:'mismatch',issues:['entity_order:1'],recordKey:prefix+'items/spa-42.json'};
 const job={jobId,state:'complete',total:1,cursor:1,results:[finding],deadline:new Date(now.getTime()+3600000).toISOString(),sourceIssues:[],worldCounts:{vacations:0,events:0,rooms:0,spa:1}};
 const bucket=new FakeR2({[prefix+'job.json']:JSON.stringify(job),[finding.recordKey]:JSON.stringify({finding,api,normalized,acceptedContract:await buildAcceptedGalleryContract('spa',baseline),normalizedContract:await buildAcceptedGalleryContract('spa',normalized),fetchedAt:now.toISOString(),rawKey:prefix+'context/spa.json'})});
 try{assert.equal((await runSupplierCatalogSync(db,{id:'spa-order-seed',world:'spa',source:'test',baseline:[baseline],now:()=>now,fetchCandidate:async()=>({fetchedAt:now.toISOString(),entries:[baseline]})})).status,'accepted');
  const receipt=await applyGalleryAuditWorld({db,bucket,jobId,world:'spa'});assert.equal(receipt.state,'accepted',JSON.stringify(receipt));assert.equal(receipt.verified,1);assert.equal(receipt.skipped,0);
  const row=await db.prepare('SELECT summary_json FROM supplier_catalog_entries WHERE run_id = ?').bind(receipt.runId).first(),summary=JSON.parse(row.summary_json);assert.deepEqual(summary.packages.map(p=>[p.id,p.title,p.price]),[[7,'Seven',777],[3,'Three',333]]);assert.equal(compareGalleryContracts(api,await buildAcceptedGalleryContract('spa',{supplierId:42,summary})).equal,true);
 }finally{db.close();}
});

async function singleFixture(){
 const db=await database(),world='vacations';
 const current={supplierId:1,summary:{name:'Owner',price:420,features:['Pool'],images:['/gallery/same.jpg']},detail:{price:420,features:['Pool'],images:['/gallery/same.jpg'],galleryGroups:[{id:'old',images:['/gallery/same.jpg']}],rooms:[{id:100,name:'Unit',images:['/gallery/same.jpg'],galleryGroups:[{id:'old-room',images:['/gallery/same.jpg']}]}]}};
 const normalized=structuredClone(current);normalized.detail.galleryGroups[0].id='9';normalized.detail.rooms[0].galleryGroups[0].id='2';
 const raw={api_version:1.1,created:new Date().toISOString(),id:1,active:true,galleries:{9:{galleryID:9,title:'123',pictures:['/gallery/same.jpg']}},rooms:[{roomID:100,galleries:[{galleryID:2,title:'456',pictures:['/gallery/same.jpg']}]}]},wire=JSON.stringify(raw);
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(wire)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const finding={world,supplierId:1,status:'mismatch',recordKey:prefix+'items/vacations-1.json',sha256:digest};
 const bucket=new FakeR2({[prefix+'job.json']:JSON.stringify({jobId,state:'complete',total:1,cursor:1,results:[finding],deadline:new Date(Date.now()+3600000).toISOString(),sourceIssues:[],worldCounts:{vacations:1,events:0,rooms:0,spa:0}}),[prefix+'context/vacations.json']:JSON.stringify({places:[{siteID:1,active:true,rooms:[{roomID:100}]}]}),[prefix+'raw/vacations-1.json']:wire,[finding.recordKey]:JSON.stringify({finding,api:await buildApiGalleryContract(world,1,raw,wire),normalized,acceptedContract:await buildAcceptedGalleryContract(world,current),normalizedContract:await buildAcceptedGalleryContract(world,normalized),fetchedAt:new Date().toISOString(),rawKey:prefix+'raw/vacations-1.json'})});
 assert.equal((await runSupplierCatalogSync(db,{id:'bounded-baseline',world,source:'test',baseline:[current],fetchCandidate:async()=>({fetchedAt:new Date().toISOString(),entries:[current]})})).status,'accepted');
 return {db,bucket,jobId,world,current,runId:`gallery-${jobId}-${world}`,stateKey:prefix+'apply/vacations.bounded.json'};
}

async function scopedFixture(extraEmpty=false,quarantine=false,large=false){
 const f=await singleFixture();
 const statements=[];
 for(let id=2;id<=545;id++)statements.push(f.db.prepare('INSERT INTO supplier_catalog_entries(id,run_id,world,supplier_id,summary_json,detail_json) VALUES(?,?,?,?,?,?)').bind(`bounded-baseline:vacations:${id}`,'bounded-baseline',f.world,id,` { "name" : "Sibling ${id}", "price" : ${id+100} } `,`{\n "note" : "keep raw bytes ${id}${large?'x'.repeat(32768):''}", "rooms" : []\n}`));
 await f.db.batch(statements);await f.db.prepare('UPDATE supplier_catalog_state SET active_count=545 WHERE world=?').bind(f.world).run();
 const object=await f.bucket.get(prefix+'job.json'),job=JSON.parse(await object.text());job.scopeWorld=f.world;job.scopeSupplierId=1;await f.bucket.put(prefix+'job.json',JSON.stringify(job));
 if(extraEmpty||quarantine){const path=prefix+'items/vacations-1.json',item=JSON.parse(await(await f.bucket.get(path)).text()),raw=JSON.parse(await(await f.bucket.get(prefix+'raw/vacations-1.json')).text());if(extraEmpty){raw.rooms.push({roomID:101,galleries:[]});item.normalized.detail.rooms.push({id:101,name:'Unpublished empty API owner',images:[],galleryGroups:[]});}if(quarantine)raw.galleries[9].pictures.push('/gallery/16635036794342.jpeg');const wire=JSON.stringify(raw);item.finding.sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(wire)))].map(x=>x.toString(16).padStart(2,'0')).join('');item.api=await buildApiGalleryContract(f.world,1,raw,wire);item.normalizedContract=await buildAcceptedGalleryContract(f.world,item.normalized);await f.bucket.put(prefix+'raw/vacations-1.json',wire);await f.bucket.put(path,JSON.stringify(item));await f.bucket.put(prefix+'context/vacations.json',JSON.stringify({places:[{siteID:1,active:true,rooms:[{roomID:100},...(extraEmpty?[{roomID:101}]:[])]}]}));}
 return f;
}
test('single-owner repair clones 544 raw sibling payloads, retains an unpublished empty API owner, and postverifies the complete generation',async()=>{
 const f=await scopedFixture(true,true,true);const oldFetch=globalThis.fetch;let network=0;globalThis.fetch=async()=>{network++;throw Error('quarantine_must_not_be_fetched');};try{
  let state=await startBoundedGalleryApply(f);assert.equal(state.scopeSupplierId,1);state=await stepBoundedGalleryApply(f);assert.equal(state.phase,'prepare');assert.equal(state.total,545);assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM supplier_catalog_entries WHERE run_id=?').bind(f.runId).first()).n,544);
  state=await stepBoundedGalleryApply(f);assert.equal(state.phase,'accept');assert.equal(state.cursor,545);assert.equal(state.changed,1);assert.equal((await f.db.prepare('SELECT active_run_id FROM supplier_catalog_state WHERE world=?').bind(f.world).first()).active_run_id,'bounded-baseline');
  state=await stepBoundedGalleryApply(f);assert.equal(state.phase,'verify');state=await stepBoundedGalleryApply(f);assert.equal(state.state,'accepted',JSON.stringify(state));assert.equal(state.verified,1);assert.equal(state.preservedVerified,544);assert.equal(state.verifyCursor,545);assert.equal(state.verificationIssues.length,0);assert.ok(state.sourceWarnings.some(x=>x.issues.includes('unverified_unpublished_empty_api_owner:vacations:1:room:101')));assert.ok(state.sourceWarnings.some(x=>x.issues.includes('unverified_quarantined_api_media:16635036794342.jpeg')));assert.equal(network,0);
  const a=(await f.db.prepare('SELECT supplier_id,summary_json,detail_json FROM supplier_catalog_entries WHERE run_id=? AND supplier_id<>1 ORDER BY supplier_id').bind('bounded-baseline').all()).results,b=(await f.db.prepare('SELECT supplier_id,summary_json,detail_json FROM supplier_catalog_entries WHERE run_id=? AND supplier_id<>1 ORDER BY supplier_id').bind(f.runId).all()).results;assert.deepEqual(b,a);
  const target=JSON.parse((await f.db.prepare('SELECT detail_json FROM supplier_catalog_entries WHERE run_id=? AND supplier_id=1').bind(f.runId).first()).detail_json);assert.equal(target.price,420);assert.equal(target.rooms.length,1);assert.equal(target.galleryGroups[0].id,'9');const writes=f.bucket.writes.length;assert.deepEqual(await startBoundedGalleryApply(f),state);assert.equal(f.bucket.writes.length,writes);
 }finally{globalThis.fetch=oldFetch;f.db.close();}
});
test('fast scoped verification rechecks the full set after an older four-row verifier without double counters',async()=>{
 const f=await scopedFixture();try{await startBoundedGalleryApply(f);await stepBoundedGalleryApply(f);await stepBoundedGalleryApply(f);let state=await stepBoundedGalleryApply(f);Object.assign(state,{verifyCursor:4,verified:1,preservedVerified:3});await f.bucket.put(f.stateKey,JSON.stringify(state));state=await stepBoundedGalleryApply(f);assert.equal(state.state,'accepted');assert.equal(state.verified,1);assert.equal(state.preservedVerified,544);assert.equal(state.verifyCursor,545);}finally{f.db.close();}
});
test('a pointer change between scoped sibling SQL and target verification cannot report success',async()=>{
 const f=await scopedFixture();try{await startBoundedGalleryApply(f);await stepBoundedGalleryApply(f);await stepBoundedGalleryApply(f);await stepBoundedGalleryApply(f);const prepare=f.db.prepare;let changed=false;f.db.prepare=sql=>{const stmt=prepare(sql);if(sql.startsWith('SELECT summary_json AS summaryJson')){const first=stmt.first;stmt.first=async()=>{const value=await first();if(!changed){changed=true;await prepare('UPDATE supplier_catalog_state SET active_run_id=? WHERE world=?').bind('bounded-baseline',f.world).run();}return value;};}return stmt;};const state=await stepBoundedGalleryApply(f);assert.equal(changed,true);assert.notEqual(state.state,'accepted');assert.equal(state.errorCode,'gallery_postverify_generation_changed');assert.equal(state.verified,0);}finally{f.db.close();}
});
test('targeted clone refuses missing target, partial clone, changed sibling, and changed baseline before acceptance',async()=>{
 for(const change of ['missing','partial','sibling','baseline','duplicate']){const f=await scopedFixture();try{
  await startBoundedGalleryApply(f);
  if(change==='missing')await f.db.prepare('DELETE FROM supplier_catalog_entries WHERE run_id=? AND supplier_id=1').bind('bounded-baseline').run();
  let state=await stepBoundedGalleryApply(f);
  if(change==='missing'){assert.equal(state.state,'not_accepted');assert.equal(state.errorCode,'gallery_active_generation_incomplete');continue;}
  state=await stepBoundedGalleryApply(f);assert.equal(state.phase,'accept');
  if(change==='partial')await f.db.prepare('DELETE FROM supplier_catalog_entries WHERE run_id=? AND supplier_id=2').bind(f.runId).run();
  if(change==='sibling')await f.db.prepare('UPDATE supplier_catalog_entries SET summary_json=? WHERE run_id=? AND supplier_id=2').bind('{"name":"tampered"}',f.runId).run();
  if(change==='baseline'){await f.db.prepare("INSERT INTO supplier_catalog_runs(id,world,source,status,started_at) VALUES(?,?,?,'accepted',?)").bind('newer-run',f.world,'test-native',new Date().toISOString()).run();await f.db.prepare('INSERT INTO supplier_catalog_entries(id,run_id,world,supplier_id,summary_json,detail_json) SELECT ? || supplier_id,?,world,supplier_id,summary_json,detail_json FROM supplier_catalog_entries WHERE run_id=?').bind('newer:', 'newer-run','bounded-baseline').run();await f.db.prepare('UPDATE supplier_catalog_state SET active_run_id=? WHERE world=?').bind('newer-run',f.world).run();}
  if(change==='duplicate'){state.ids.push(2);await f.bucket.put(f.stateKey,JSON.stringify(state));}
  state=await stepBoundedGalleryApply(f);assert.equal(state.state,'not_accepted',change+JSON.stringify(state));assert.equal((await f.db.prepare('SELECT active_run_id FROM supplier_catalog_state WHERE world=?').bind(f.world).first()).active_run_id,change==='baseline'?'newer-run':'bounded-baseline');
 }finally{f.db.close();}}
});
test('targeted postverify detects changed raw sibling bytes after activation and cannot report completion',async()=>{
 const f=await scopedFixture();try{await startBoundedGalleryApply(f);await stepBoundedGalleryApply(f);await stepBoundedGalleryApply(f);let state=await stepBoundedGalleryApply(f);assert.equal(state.phase,'verify');await f.db.prepare('UPDATE supplier_catalog_entries SET detail_json=? WHERE run_id=? AND supplier_id=2').bind('{ "note" : "out-of-band mutation" }',f.runId).run();state=await stepBoundedGalleryApply(f);assert.equal(state.phase,'verify');assert.notEqual(state.state,'accepted');assert.equal(state.errorCode,'gallery_scoped_sibling_changed');assert.ok(state.verifyCursor<545);}finally{f.db.close();}
});
test('targeted audit identity cannot be widened or silently accepted without source proof',async()=>{
 for(const change of ['world','id','source']){const f=await scopedFixture();try{
  if(change!=='source'){const job=JSON.parse(await(await f.bucket.get(prefix+'job.json')).text());if(change==='world')job.scopeWorld='events';else job.scopeSupplierId=999;await f.bucket.put(prefix+'job.json',JSON.stringify(job));}
  if(change==='world'){await assert.rejects(startBoundedGalleryApply(f),/scoped_identity/);continue;}
  await startBoundedGalleryApply(f);let state=await stepBoundedGalleryApply(f);
  if(change==='id'){assert.equal(state.state,'not_accepted');assert.equal(state.errorCode,'gallery_audit_baseline_inventory_changed');continue;}
  const path=prefix+'items/vacations-1.json',item=JSON.parse(await(await f.bucket.get(path)).text());delete item.normalized;await f.bucket.put(path,JSON.stringify(item));state=await stepBoundedGalleryApply(f);assert.equal(state.state,'not_accepted');assert.equal(state.errorCode,'gallery_scoped_source_not_proven');assert.equal((await f.db.prepare('SELECT active_run_id FROM supplier_catalog_state WHERE world=?').bind(f.world).first()).active_run_id,'bounded-baseline');
 }finally{f.db.close();}}
});

test('actual SQLite bounded writer paces native revision metadata across lease and progress commits',async()=>{
 const f=await singleFixture();try{
  const put=f.bucket.put.bind(f.bucket),get=f.bucket.get.bind(f.bucket),times=new Map();let rejected=0;
  f.bucket.put=async(key,value,options)=>{if(key===f.stateKey&&times.has(key)&&Date.now()-times.get(key)<1000){rejected++;throw Error('native_rate_limited');}const result=await put(key,value,options);if(result&&key===f.stateKey){times.set(key,Date.now());result.uploaded=new Date(times.get(key));}return result;};
  f.bucket.get=async key=>{const value=await get(key);return value&&key===f.stateKey&&times.has(key)?{...value,uploaded:new Date(times.get(key))}:value;};
  const result=await applyGalleryAuditWorld(f);assert.equal(result.state,'accepted');assert.equal(result.verified,1);assert.equal(rejected,0);
 }finally{f.db.close();}
});

async function continuationFixture(){
 const f=await singleFixture();await startBoundedGalleryApply(f);await stepBoundedGalleryApply(f);await stepBoundedGalleryApply(f);
 const state=await readBoundedGalleryApply(f.bucket,f.jobId,f.world);assert.equal(state.phase,'accept');state.createdAt=new Date(Date.now()-56*60000).toISOString();state.deadline=new Date(Date.now()+4*60000).toISOString();await f.bucket.put(f.stateKey,JSON.stringify(state));return f;
}
test('one explicit large-apply continuation preserves the exact staged prefix and fixed hard deadline',async()=>{
 const f=await continuationFixture();try{const before=await readBoundedGalleryApply(f.bucket,f.jobId,f.world),state=await continueBoundedGalleryApply(f);assert.equal(state.deadline,new Date(Date.parse(before.createdAt)+120*60000).toISOString());assert.equal(state.cursor,1);assert.equal(state.recoveryWindowUsed,true);
  const writes=f.bucket.writes.length;assert.deepEqual(await continueBoundedGalleryApply(f),state);assert.equal(f.bucket.writes.length,writes);assert.equal((await f.db.prepare('SELECT active_run_id FROM supplier_catalog_state WHERE world=?').bind(f.world).first()).active_run_id,'bounded-baseline');assert.equal((await applyGalleryAuditWorld(f)).state,'accepted');
 }finally{f.db.close();}
});
test('early, expired, leased and mismatched-prefix continuations refuse without progress writes',async()=>{
 for(const change of ['early','expired','lease','prefix','duplicate','foreign']){const f=await continuationFixture();try{const state=await readBoundedGalleryApply(f.bucket,f.jobId,f.world);
  if(change==='early')state.deadline=new Date(Date.now()+60*60000).toISOString();if(change==='expired'){state.createdAt=new Date(Date.now()-121*60000).toISOString();state.deadline=new Date(Date.now()-61*60000).toISOString();}if(change==='lease')state.lease={owner:'other',until:new Date(Date.now()+60000).toISOString()};if(change==='duplicate'){state.ids=[1,1];state.total=2;}if(change==='foreign'){state.jobId='other';state.recoveryWindowUsed=true;}
  await f.bucket.put(f.stateKey,JSON.stringify(state));if(change==='prefix')await f.db.prepare('DELETE FROM supplier_catalog_entries WHERE run_id=?').bind(f.runId).run();const writes=f.bucket.writes.length;await assert.rejects(continueBoundedGalleryApply(f));assert.equal(f.bucket.writes.length,writes,change);
 }finally{f.db.close();}}
});
test('real concurrent steps yield one initialized generation and one CAS loser',async()=>{
 const f=await singleFixture();try{
  await startBoundedGalleryApply(f);
  const results=await Promise.allSettled([stepBoundedGalleryApply(f),stepBoundedGalleryApply(f)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  const rejected=results.find(x=>x.status==='rejected');assert.match(rejected.reason.message,/gallery_apply_step_in_progress/);
  const state=await readBoundedGalleryApply(f.bucket,jobId,f.world);assert.equal(state.phase,'prepare');assert.equal(state.cursor,0);
  assert.equal((await f.db.prepare('SELECT lock_run_id FROM supplier_catalog_state WHERE world=?').bind(f.world).first()).lock_run_id,f.runId);
 }finally{f.db.close();}
});
test('lost progress response resumes the same prepared supplier without duplicate staging or counters',async()=>{
 const f=await singleFixture();try{
  await startBoundedGalleryApply(f);await stepBoundedGalleryApply(f);
  const put=f.bucket.put.bind(f.bucket);let disconnected=false;
  f.bucket.put=async(key,value,options)=>{if(!disconnected&&key===f.stateKey&&JSON.parse(value).cursor===1){disconnected=true;throw Error('simulated_disconnect');}return put(key,value,options);};
  await assert.rejects(stepBoundedGalleryApply(f),/simulated_disconnect/);
  let state=await readBoundedGalleryApply(f.bucket,jobId,f.world);assert.equal(state.cursor,0);assert.ok(state.lease);
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM supplier_catalog_entries WHERE run_id=?').bind(f.runId).first()).n,1);
  state.lease.until=new Date(Date.now()-1000).toISOString();await put(f.stateKey,JSON.stringify(state));
  state=await stepBoundedGalleryApply(f);assert.equal(state.cursor,1);assert.equal(state.changed,1);assert.equal(state.phase,'accept');
  state=await stepBoundedGalleryApply(f);assert.equal(state.phase,'verify');state=await stepBoundedGalleryApply(f);assert.equal(state.phase,'complete');assert.equal(state.verified,1);
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM supplier_catalog_entries WHERE run_id=?').bind(f.runId).first()).n,1);
 }finally{f.db.close();}
});
async function seedLegacy(f,{live=false,staged=false}={}){
 await f.db.prepare("INSERT INTO supplier_catalog_runs(id,world,source,status,started_at) VALUES(?,?,?,'running',?)").bind(f.runId,f.world,'manual',new Date(Date.now()-20*60000).toISOString()).run();
 await f.db.prepare('UPDATE supplier_catalog_state SET lock_run_id=?,lock_until=? WHERE world=?').bind(f.runId,new Date(Date.now()+(live?120000:-1000)).toISOString(),f.world).run();
 if(staged)await f.db.prepare('INSERT INTO supplier_catalog_entries(id,run_id,world,supplier_id,summary_json,detail_json) VALUES(?,?,?,?,?,?)').bind(f.runId+':vacations:1',f.runId,f.world,1,JSON.stringify(f.current.summary),JSON.stringify(f.current.detail)).run();
 await f.bucket.put(prefix+'apply/vacations.json',JSON.stringify({jobId,world:f.world,runId:f.runId,state:'reserved',changed:0,skipped:0,verified:0,verificationIssues:[]}));
}
test('legacy live lease cannot be recovered or released by the new engine',async()=>{
 const f=await singleFixture();try{await seedLegacy(f,{live:true});await assert.rejects(startBoundedGalleryApply(f),/reconciliation/);await startBoundedGalleryApply({...f,recovery:true});
  const state=await stepBoundedGalleryApply(f);assert.equal(state.phase,'initialize');assert.equal(state.errorCode,'gallery_catalog_lock_busy');
  assert.equal((await f.db.prepare('SELECT status FROM supplier_catalog_runs WHERE id=?').bind(f.runId).first()).status,'running');assert.equal((await f.db.prepare('SELECT lock_run_id FROM supplier_catalog_state WHERE world=?').bind(f.world).first()).lock_run_id,f.runId);
 }finally{f.db.close();}
});
test('expired legacy operation with zero staged rows recovers only with explicit acknowledgement',async()=>{
 const f=await singleFixture();try{await seedLegacy(f);await assert.rejects(startBoundedGalleryApply(f),/reconciliation/);await startBoundedGalleryApply({...f,recovery:true});let state=await stepBoundedGalleryApply(f);assert.equal(state.phase,'prepare');state=await stepBoundedGalleryApply(f);state=await stepBoundedGalleryApply(f);state=await stepBoundedGalleryApply(f);assert.equal(state.state,'accepted');assert.equal(state.verified,1);
 }finally{f.db.close();}
});
test('legacy partially staged operation remains untouched pending reconciliation',async()=>{
 const f=await singleFixture();try{await seedLegacy(f,{staged:true});await startBoundedGalleryApply({...f,recovery:true});const state=await stepBoundedGalleryApply(f);assert.equal(state.state,'not_accepted');assert.equal(state.errorCode,'gallery_legacy_recovery_requires_review');
  assert.equal((await f.db.prepare('SELECT active_run_id FROM supplier_catalog_state WHERE world=?').bind(f.world).first()).active_run_id,'bounded-baseline');assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM supplier_catalog_entries WHERE run_id=?').bind(f.runId).first()).n,1);
  assert.equal((await f.db.prepare('SELECT status FROM supplier_catalog_runs WHERE id=?').bind(f.runId).first()).status,'running');
 }finally{f.db.close();}
});
async function simulateStoppedPreparation(f,code){
 await startBoundedGalleryApply(f);let state=await stepBoundedGalleryApply(f);
 await finishSupplierCatalogRun(f.db,{id:f.runId,world:f.world,status:'failed',errorCode:code,finishedAt:new Date().toISOString()});
 Object.assign(state,{phase:'error',state:'not_accepted',errorCode:code});await f.bucket.put(f.stateKey,JSON.stringify(state));return state;
}
test('reviewed source-file recovery keeps the supplier, never refetches the failed image and gets one fixed continuation window',async()=>{
 const f=await singleFixture(),savedFetch=globalThis.fetch;try{
  let state=await simulateStoppedPreparation(f,'archive_image_type_invalid');state.createdAt=new Date(Date.now()-70*60000).toISOString();state.deadline=new Date(Date.now()-10*60000).toISOString();await f.bucket.put(f.stateKey,JSON.stringify(state));
  let network=0;globalThis.fetch=async()=>{network++;throw Error('image_must_not_be_retried');};
  state=await recoverBoundedGalleryApply(f);assert.equal(state.phase,'prepare');assert.equal(state.cursor,0);assert.equal(state.sourceRecoveryUsed,true);assert.equal(state.deadline,new Date(Date.parse(state.createdAt)+120*60000).toISOString());assert.equal(state.recoveryWindowUsed,true);
  const result=await applyGalleryAuditWorld(f);assert.equal(result.state,'accepted');assert.equal(result.changed,0);assert.equal(result.verified,0);assert.equal(result.skipped,1);assert.equal(network,0);assert.equal(result.sourceWarnings[0].issues[0],'unverified_source_media:archive_image_type_invalid');
  const row=JSON.parse((await f.db.prepare('SELECT detail_json FROM supplier_catalog_entries WHERE run_id=?').bind(f.runId).first()).detail_json);assert.equal(row.galleryGroups[0].id,'old');assert.equal(row.price,420);await assert.rejects(recoverBoundedGalleryApply(f),/requires_review/);
 }finally{globalThis.fetch=savedFetch;f.db.close();}
});
test('internal archive corruption cannot enter reviewed source-file recovery',async()=>{
 const f=await singleFixture();try{await simulateStoppedPreparation(f,'archive_existing_checksum_mismatch');const writes=f.bucket.writes.length;await assert.rejects(recoverBoundedGalleryApply(f),/requires_review/);assert.equal(f.bucket.writes.length,writes);assert.equal((await f.db.prepare('SELECT active_run_id FROM supplier_catalog_state WHERE world=?').bind(f.world).first()).active_run_id,'bounded-baseline');}finally{f.db.close();}
});
test('a lost recovery acknowledgement reconciles its reserved native transition instead of failing or restoring it twice',async()=>{
 const f=await singleFixture();try{await simulateStoppedPreparation(f,'gallery_nonmedia_facts_changed');const put=f.bucket.put.bind(f.bucket);let lost=false;
  f.bucket.put=async(k,v,o)=>{if(!lost&&k===f.stateKey&&JSON.parse(v).phase==='prepare'){lost=true;throw Error('lost_recovery_ack');}return put(k,v,o);};
  await assert.rejects(recoverBoundedGalleryApply(f),/lost_recovery_ack/);let state=await readBoundedGalleryApply(f.bucket,jobId,f.world);assert.equal(state.phase,'error');assert.ok(state.recoveryIntent);assert.equal((await f.db.prepare('SELECT status FROM supplier_catalog_runs WHERE id=?').bind(f.runId).first()).status,'running');
  state.lease.until=new Date(Date.now()-1).toISOString();await put(f.stateKey,JSON.stringify(state));state=await recoverBoundedGalleryApply(f);assert.equal(state.phase,'prepare');assert.equal(state.factsRecoveryUsed,true);assert.equal(state.cursor,0);assert.equal((await applyGalleryAuditWorld(f)).verified,1);assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM supplier_catalog_entries WHERE run_id=?').bind(f.runId).first()).n,1);
 }finally{f.db.close();}
});
