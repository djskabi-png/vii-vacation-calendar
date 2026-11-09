import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { runSupplierCatalogSync } from "../app/lib/supplier-catalog-sync.ts";
import { startBoundedGalleryApply, stepBoundedGalleryApply, readBoundedGalleryApply } from "../app/lib/gallery-audit-bounded-apply.ts";
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
  for (const name of ["0000_groovy_boomerang", "0001_brief_pixie", "0002_sour_tigra", "0003_catalog_diagnostics"]) {
    const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
    for (const sql of source.split("--> statement-breakpoint").map(part => part.trim()).filter(Boolean)) sqlite.exec(sql);
  }
  const prepare = sql => { let values = []; return { bind(...args) { values = args; return this; }, async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; };
  return { prepare, async batch(statements) { sqlite.exec("BEGIN"); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } }, close() { sqlite.close(); } };
}


async function runPrefetchCase(tamper=''){
 const db=await database(), baseline=[], normalized=[], findings=[], objects={};
 const hash=async wire=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(wire)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 for(let i=1;i<=9;i++){
  const old={supplierId:i,summary:{name:'Place '+i,price:420,features:['Pool'],images:['/gallery/same.jpg']},detail:{price:420,features:['Pool'],images:['/gallery/same.jpg'],galleryGroups:[{id:'old',images:['/gallery/same.jpg']}],rooms:[{id:i*100,name:'Unit '+i,images:['/gallery/same.jpg'],galleryGroups:[{id:'old-room',images:['/gallery/same.jpg']}]}]}};
  if(tamper==='empty'||tamper==='emptyErase')old.detail.rooms.push({id:i*100+1,name:'Empty owner',images:tamper==='emptyErase'?['/gallery/same.jpg']:[],galleryGroups:[]});
  const next=structuredClone(old);next.detail.galleryGroups[0].id='9';next.detail.rooms[0].galleryGroups[0].id='2';baseline.push(old);normalized.push(next);
  if(tamper==='emptyPlace'){old.summary.images=[];old.detail.images=[];old.detail.galleryGroups=[];}
  if(tamper==='extraEmpty'||tamper==='extraNonempty')next.detail.rooms.push({id:i*100+1,name:'Unaccepted API owner',images:tamper==='extraNonempty'?['/gallery/same.jpg']:[],galleryGroups:tamper==='extraNonempty'?[{id:'3',images:['/gallery/same.jpg']}]:[]});
  const raw={api_version:1.1,created:now.toISOString(),id:i,active:true,galleries:{9:{galleryID:9,title:String(123),pictures:['/gallery/same.jpg']}},rooms:[{roomID:i*100,galleries:[{galleryID:2,title:String(456),pictures:['/gallery/same.jpg']}]}]};if(tamper==='empty'||tamper==='emptyErase'){raw.rooms.push({roomID:i*100+1,galleries:[]});next.detail.rooms[1].images=[];}if(tamper==='extraEmpty'||tamper==='extraNonempty')raw.rooms.push({roomID:i*100+1,galleries:tamper==='extraNonempty'?[{galleryID:3,title:'New',pictures:['/gallery/same.jpg']}]:[]});const wire=JSON.stringify(raw);
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
  const receipt=await applyGalleryAuditWorld({db,bucket,jobId,world:'vacations'});
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
 }finally{db.close();}
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
test('actual SPA generation repairs API package-owner order without changing prices or titles',async()=>{
 const db=await database(),wire='{"status":"ok","sites":{"42":{"siteid":42,"title":"Spa","city":"Haifa","spa_picture":"https://www.spaplus.co.il/gallery/site.jpg","gallery":["https://www.spaplus.co.il/gallery/site.jpg"],"packages":{"7":{"MainPageID":7,"idPack":70,"MainPageTitle":"Seven","price":700,"pack_picture":"https://www.spaplus.co.il/gallery/seven.jpg"},"3":{"MainPageID":3,"idPack":30,"MainPageTitle":"Three","price":300,"pack_picture":"https://www.spaplus.co.il/gallery/three.jpg"}}}}}';
 const raw=parseOrderedJson(wire),normalized=normalizeSpaPlusCatalog(raw)[0],baseline=structuredClone(normalized);baseline.summary.packages.reverse();baseline.summary.packages[0].price=333;baseline.summary.packages[1].price=777;
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
