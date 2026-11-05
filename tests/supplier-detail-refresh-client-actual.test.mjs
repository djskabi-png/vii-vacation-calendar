import test from 'node:test';import assert from 'node:assert/strict';
import {createSergeyPublicCatalogClient} from '../app/lib/sergey-public-catalog-client.ts';
import {validSupplierDetailProof} from '../app/lib/supplier-detail-contract.ts';
const start=Date.parse('2026-11-05T12:00:00Z');
const baseline=()=>[1,2,3].map(supplierId=>({supplierId,summary:{supplierId,name:`Place ${supplierId}`,image:`/gallery/old-${supplierId}.jpg`,previewText:'old preview'},detail:{images:[`/gallery/old-${supplierId}.jpg`],rooms:[{id:100+supplierId,images:[`/gallery/unit-${supplierId}.jpg`]}]}}));
function harness(){let time=start,partial=false,clearPreview=false;const reads=[];
 const fetchImpl=async url=>{const path=new URL(url).pathname.replace('/api/ai/vii','');
 if(path==='/locations')return Response.json({cities:[{id:1,title:'City',area:2}],areas:[{id:2,title:'Area'}]});
 if(path==='/vacations/types')return Response.json({amenities:[],roomTypes:[],amenity_categories:[]});
 if(path==='/vacations')return Response.json({places:[1,2,3].map(siteID=>({siteID,siteName:`Place ${siteID}`,active:true,location:{cityID:1},rooms:[{roomID:100+siteID}],galleries:[],...(clearPreview?{preview_text:null}:{})}))});
 const id=Number(path.split('/').at(-1));reads.push(id);
 const raw={id,active:true,name:`Place ${id}`,location:{city:1},api_version:1.1,created:new Date(time).toISOString(),shared_amenities:[],galleries:{1:{galleryID:1,title:'Main',pictures:[`/gallery/current-${id}.jpg`]}},rooms:[{roomID:100+id,roomName:'Unit',galleries:[],amenities:[],spaces:[]}]};
 if(partial&&id===1)delete raw.shared_amenities;
 return Response.json(raw);};
 return{reads,at(hour){time=start+hour*3600000;},partial(){partial=true;},clear(){clearPreview=true;},pull:(previous,options={})=>createSergeyPublicCatalogClient({apiKey:'fixture',fetchImpl,now:()=>new Date(time),detailRefreshLimit:1,...options}).fetchCandidate('vacations',previous),now:()=>new Date(time)};
}
test('actual supplier calls move across oldest IDs, persist successful proof stamps and stop while the week is fresh',async()=>{
 const h=harness();let entries=baseline();for(let hour=0;hour<3;hour++){h.at(hour);const next=await h.pull(entries);assert.equal(next.entries.length,3);const refreshed=next.entries.find(entry=>entry.supplierId===hour+1);assert.ok(refreshed?.detailProof);assert.equal(await validSupplierDetailProof(refreshed.detailProof,refreshed,h.now()),true);entries=next.entries;}
 h.at(3);entries=(await h.pull(entries)).entries;assert.deepEqual(h.reads,[1,2,3]);for(const entry of entries)assert.ok(entry.detail._viiCatalog.checkedAt);
 h.at(7*24);await h.pull(entries);assert.deepEqual(h.reads,[1,2,3,1]);
});
test('readonly inspection retains normalized unproved candidate without publishing it',async()=>{
 const h=harness();h.partial();const result=await h.pull(baseline(),{retainUnprovedDetails:false});
 assert.deepEqual(result.deferredDetailIds,[1]);const candidate=result.entries.find(entry=>entry.supplierId===1);assert.ok(candidate);assert.equal(candidate.detail.images[0],'/api/vii/media/current-1.jpg');assert.equal(candidate.detail._viiCatalog,undefined);
 assert.deepEqual(result.detailProofIssues,[{supplierId:1,code:'site_amenities_schema'}]);
});

test('read-only targeted inspection checks the requested accepted place and cannot become a writer override',async()=>{
 const h=harness();const next=await h.pull(baseline(),{retainUnprovedDetails:false,inspectionSupplierId:3});
 assert.deepEqual(h.reads,[3]);assert.ok(next.entries.find(entry=>entry.supplierId===3).detailProof);
 await assert.rejects(()=>h.pull(baseline(),{inspectionSupplierId:2}),/invalid_supplier_inspection/);
 await assert.rejects(()=>h.pull(baseline(),{retainUnprovedDetails:false,inspectionSupplierId:999}),/invalid_supplier_inspection/);
 assert.deepEqual(h.reads,[3]);
});
test('actual partial detail keeps all accepted business facts, records deferral and cannot starve the next place',async()=>{
 const h=harness();h.partial();const old=baseline(),first=await h.pull(old);assert.deepEqual(first.deferredDetailIds,[1]);const {_viiCatalog,...facts}=first.entries[0].detail;assert.deepEqual(facts,old[0].detail);assert.equal(_viiCatalog.checkedAt,undefined);
 h.at(1);const second=await h.pull(first.entries);assert.deepEqual(h.reads,[1,2]);assert.equal(second.entries[0].detail.images[0],'/gallery/old-1.jpg');assert.ok(second.entries[1].detail._viiCatalog.checkedAt);
});
test('actual cached-detail list update clears an explicitly removed preview without another detail request',async()=>{
 const h=harness();let entries=baseline();for(let hour=0;hour<3;hour++){h.at(hour);entries=(await h.pull(entries)).entries;}
 h.clear();h.at(4);const result=await h.pull(entries);assert.deepEqual(h.reads,[1,2,3]);assert.ok(result.entries.every(entry=>!Object.hasOwn(entry.summary,'previewText')));
});
