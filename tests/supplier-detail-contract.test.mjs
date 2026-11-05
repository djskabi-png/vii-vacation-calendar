import test from 'node:test';import assert from 'node:assert/strict';
import {proveSupplierDetail,validSupplierDetailProof} from '../app/lib/supplier-detail-contract.ts';
import {reviewedInactiveTransition} from '../app/lib/reviewed-catalog-inventory.ts';
const now=new Date('2026-11-05T12:00:00Z');
const raw=()=>({api_version:1.1,created:now.toISOString(),id:17,active:true,galleries:{1:{galleryID:1,title:'Main',pictures:['/gallery/current.jpg']}},shared_amenities:[],rooms:[{roomID:2,galleries:[],amenities:[],spaces:[]}]});
const entry={supplierId:17,summary:{name:'Place'},detail:{images:['/api/vii/media/current.jpg'],rooms:[{id:2,images:[]}]}};
test('full official site-page proof binds the exact normalized place, not a flag or old fingerprint',async()=>{
 const proof=await proveSupplierDetail(raw(),{siteID:17,rooms:[{roomID:2}]},entry,now);assert.ok(proof);assert.equal(await validSupplierDetailProof(proof,entry,now),true);
 assert.equal(await validSupplierDetailProof(proof,{...entry,detail:{images:['/api/vii/media/other.jpg']}},now),false);
 assert.equal(await validSupplierDetailProof({...proof,supplierId:99},entry,now),false);
 assert.equal(await validSupplierDetailProof(proof,entry,new Date('2026-11-07T12:00:00Z')),false);
});
test('partial, stale, wrong identity, unknown protocol and unsafe-media responses cannot prove replacement',async()=>{
 const candidates=[];for(const field of ['created','api_version','galleries','rooms','shared_amenities']){const value=raw();delete value[field];candidates.push(value);}
 candidates.push({...raw(),id:99},{...raw(),api_version:2},{...raw(),created:'2026-10-20T00:00:00Z'},{...raw(),created:'2026-11-06T00:00:00Z'},{...raw(),galleries:{1:{galleryID:1,title:'Main',pictures:['https://untrusted.test/gallery/current.jpg']}}});
 const noRoomGalleries=raw();delete noRoomGalleries.rooms[0].galleries;candidates.push(noRoomGalleries);
 candidates.push({...raw(),galleries:{2:{galleryID:1,title:'Main',pictures:['/gallery/current.jpg']}}});
 const duplicate=raw();duplicate.rooms.push({...duplicate.rooms[0]});candidates.push(duplicate);
 for(const value of candidates)assert.equal(await proveSupplierDetail(value,{siteID:17,rooms:[{roomID:2}]},entry,now),null);
 assert.equal(await proveSupplierDetail(raw(),{siteID:17,rooms:[{roomID:3}]},entry,now),null);
});
const withdrawn=[210,225,342,727,2168,2508,2570];
function reviewedFixture(){const retained=Array.from({length:125},(_,i)=>({supplierId:10_000+i,summary:{},detail:{rooms:[{id:i+1}]}}));return{previous:[...retained,...withdrawn.map(supplierId=>({supplierId,summary:{},detail:{rooms:[{id:supplierId}]}}))],candidate:[...retained,{supplierId:2230,summary:{}},{supplierId:2738,summary:{}}],proof:{activeCount:127,previousInactiveIds:withdrawn,previousInactiveIdsTruncated:false,previousUnknownActivityIds:[],previousUnknownActivityIdsTruncated:false}};}
test('reviewed inactive inventory approves only the observed generation and exact complete explicit-inactive set',()=>{
 const f=reviewedFixture();assert.equal(reviewedInactiveTransition('events',f.previous,f.candidate,f.proof),true);
 for(const proof of [undefined,{...f.proof,activeCount:126},{...f.proof,previousInactiveIds:withdrawn.slice(1)},{...f.proof,previousUnknownActivityIds:[210]},{...f.proof,previousInactiveIdsTruncated:true}])assert.equal(reviewedInactiveTransition('events',f.previous,f.candidate,proof),false);
 const changed=structuredClone(f.candidate);changed[0].detail.rooms=[];assert.equal(reviewedInactiveTransition('events',f.previous,changed,f.proof),false);
 assert.equal(reviewedInactiveTransition('events',f.candidate,f.candidate,f.proof),false,'not a reusable future-generation exception');
});
