import test from 'node:test';import assert from 'node:assert/strict';
import {createSergeyPublicCatalogClient} from '../app/lib/sergey-public-catalog-client.ts';
import {validSupplierDetailProof} from '../app/lib/supplier-detail-contract.ts';
const start=Date.parse('2026-11-05T12:00:00Z');
const baseline=()=>[1,2,3].map(supplierId=>({supplierId,summary:{supplierId,name:`Place ${supplierId}`,image:`/gallery/old-${supplierId}.jpg`,previewText:'old preview'},detail:{images:[`/gallery/old-${supplierId}.jpg`],rooms:[{id:100+supplierId,images:[`/gallery/unit-${supplierId}.jpg`]}]}}));
function harness({roomMismatch=false,reorderRooms=false}={}){let time=start,partial=false,clearPreview=false;const reads=[];
 const fetchImpl=async url=>{const path=new URL(url).pathname.replace('/api/ai/vii','');
 if(path==='/locations')return Response.json({cities:[{id:1,title:'City',area:2}],areas:[{id:2,title:'Area'}]});
 if(path==='/vacations/types')return Response.json({amenities:[],roomTypes:[],amenity_categories:[]});
 if(path==='/vacations')return Response.json({places:[1,2,3].map(siteID=>({siteID,siteName:`Place ${siteID}`,active:true,location:{cityID:1},rooms:reorderRooms&&siteID===1?[{roomID:101},{roomID:102}]:[{roomID:100+siteID}],galleries:[],...(clearPreview?{preview_text:null}:{})}))});
 const id=Number(path.split('/').at(-1));reads.push(id);
 const rawRooms=reorderRooms&&id===1?[{roomID:102,roomName:'Two',galleries:[{galleryID:2,title:'Two',pictures:['/gallery/two.jpg']}],amenities:[],spaces:[]},{roomID:101,roomName:'One',galleries:[{galleryID:1,title:'One',pictures:['/gallery/one.jpg']}],amenities:[],spaces:[]}]:[{roomID:roomMismatch?900+id:100+id,roomName:'Unit',galleries:[],amenities:[],spaces:[]}];
 const raw={id,active:true,name:`Place ${id}`,location:{city:1},api_version:1.1,created:new Date(time).toISOString(),shared_amenities:[],galleries:{1:{galleryID:1,title:'Main',pictures:[`/gallery/current-${id}.jpg`]}},rooms:rawRooms};
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
 assert.deepEqual(result.deferredDetailIds,[1]);const candidate=result.entries.find(entry=>entry.supplierId===1);assert.ok(candidate);assert.equal(candidate.detail.images[0],'/api/vii/media/current-1.jpg');assert.equal(candidate.detail._viiCatalog.mediaCheckedAt,h.now().toISOString());assert.equal(candidate.detail._viiCatalog.checkedAt,undefined);
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
 const h=harness();h.partial();const old=baseline(),first=await h.pull(old);assert.deepEqual(first.deferredDetailIds,[1]);const {_viiCatalog,...facts}=first.entries[0].detail;assert.equal(facts.rooms[0].id,101);assert.equal(facts.images[0],'/api/vii/media/current-1.jpg');assert.equal(_viiCatalog.checkedAt,undefined);assert.ok(_viiCatalog.mediaCheckedAt);
 h.at(1);const second=await h.pull(first.entries);assert.deepEqual(h.reads,[1,2]);assert.equal(second.entries[0].detail.images[0],'/api/vii/media/current-1.jpg');assert.ok(second.entries[1].detail._viiCatalog.checkedAt);
});
test('actual cached-detail list update clears an explicitly removed preview without another detail request',async()=>{
 const h=harness();let entries=baseline();for(let hour=0;hour<3;hour++){h.at(hour);entries=(await h.pull(entries)).entries;}
 h.clear();h.at(4);const result=await h.pull(entries);assert.deepEqual(h.reads,[1,2,3]);assert.ok(result.entries.every(entry=>!Object.hasOwn(entry.summary,'previewText')));
});
test('room identity mismatch rejects media overlay and does not advance full checkedAt',async()=>{const h=harness({roomMismatch:true});const old=baseline();old[0].detail._viiCatalog={checkedAt:'2026-11-01T12:00:00Z'};h.at(7*24);const result=await h.pull(old,{inspectionSupplierId:1,retainUnprovedDetails:false});const item=result.entries.find(entry=>entry.supplierId===1);assert.equal(item.detail.images[0],'/api/vii/media/current-1.jpg');assert.equal(item.detail._viiCatalog,undefined);assert.equal(item.detailProof,undefined);});
test('partial media refresh honors explicit preview null while retaining current media',async()=>{const h=harness();const old=baseline();h.clear();h.partial();h.at(7*24);const result=await h.pull(old,{inspectionSupplierId:1,retainUnprovedDetails:false});const item=result.entries.find(entry=>entry.supplierId===1);assert.equal(item.summary.previewText,undefined);assert.equal(item.detail.images[0],'/api/vii/media/current-1.jpg');assert.ok(item.detail._viiCatalog.mediaCheckedAt);});

test('two reordered supplier rooms retain accepted order and receive only their own current images',async()=>{
 const old=[{supplierId:1,summary:{name:'Place'},detail:{features:['Accessible'],rooms:[{id:101,name:'First',features:['Bed'],images:['/gallery/old-first.jpg']},{id:102,name:'Second',features:['Kitchen'],images:['/gallery/old-second.jpg']}],images:['/gallery/old.jpg']}}];
 const fetchImpl=async url=>{const path=new URL(url).pathname;
  if(path.endsWith('/locations'))return Response.json({cities:[{id:1,title:'City',area:2}],areas:[{id:2,title:'Area'}]});
  if(path.endsWith('/types'))return Response.json({amenities:[],amenity_categories:[],roomTypes:[]});
  if(path.endsWith('/vacations'))return Response.json({places:[{siteID:1,siteName:'Place',active:true,location:{cityID:1},rooms:[{roomID:102},{roomID:101}],galleries:[]}]});
  return Response.json({id:1,active:true,name:'Place',location:{city:1},api_version:1.1,created:new Date(start).toISOString(),galleries:{1:{galleryID:1,title:'Main',pictures:['/gallery/current.jpg']}},rooms:[102,101].map(id=>({roomID:id,roomName:'Incoming',galleries:[{galleryID:id,title:'Room',pictures:[`/gallery/current-${id}.jpg`]}]}))});
 };
 const result=await createSergeyPublicCatalogClient({apiKey:'fixture-reordered',fetchImpl,now:()=>new Date(start),detailRefreshLimit:1}).fetchCandidate('vacations',old);
 const item=result.entries[0];assert.equal(item.detailProof.contract,'vii-site-media-v1');
 assert.deepEqual(item.detail.rooms.map(room=>room.id),[101,102]);assert.deepEqual(item.detail.rooms.map(room=>room.name),['First','Second']);
 assert.deepEqual(item.detail.rooms.map(room=>room.images),[['/api/vii/media/current-101.jpg'],['/api/vii/media/current-102.jpg']]);
 assert.deepEqual(item.detail.features,['Accessible']);assert.equal(await validSupplierDetailProof(item.detailProof,item,new Date(start),old[0]),true);
});
