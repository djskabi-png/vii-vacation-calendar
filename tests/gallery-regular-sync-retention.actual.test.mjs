import assert from'node:assert/strict';import test from'node:test';
import{createSergeyPublicCatalogClient}from'../app/lib/sergey-public-catalog-client.ts';
import{buildApiGalleryContract,buildAcceptedGalleryContract,compareGalleryContracts,parseOrderedJson}from'../app/lib/supplier-gallery-contract.ts';
async function regularCase(world,membershipChange=false){
 const now=new Date();let phase=0;const calls=[];
 const wire=id=>`{"api_version":1.1,"created":"${now.toISOString()}","id":${id},"active":true,"name":"מקום ${id}","location":{"city":1},"shared_amenities":[],"galleries":{"9":{"galleryID":9,"title":"Main","pictures":["/gallery/p${id}-nine.jpg"]},"2":{"galleryID":2,"title":"Next","pictures":["/gallery/p${id}-two.jpg"]}},"rooms":[{"roomID":${id*10},"roomName":"Suite","roomCount":1,"maxGuests":2,"amenities":[],"spaces":[],"galleries":[{"galleryID":7,"title":"Suite","pictures":["/gallery/unit${id}.jpg"]}]}${membershipChange&&phase&&id===18?',{"roomID":181,"roomName":"New API unit","roomCount":1,"maxGuests":2,"amenities":[],"spaces":[],"galleries":[{"galleryID":8,"title":"New","pictures":["/gallery/new-unit181.jpg"]}]}':''}]}`;
 const listing=id=>({siteID:id,siteName:'מקום '+id,active:true,location:{cityID:1},rooms:[{roomID:id*10},...(membershipChange&&phase&&id===18?[{roomID:181}]:[])],galleries:[{galleryID:10,title:'Preview',pictures:[`/gallery/${phase?'new':'old'}-preview${id}.jpg`]}]});
 const fetchImpl=async input=>{const path=new URL(input).pathname.replace('/api/ai/vii','');calls.push(path);let body;
  if(path==='/locations')body=JSON.stringify({cities:[{id:1,title:'חיפה',area:2}],areas:[{id:2,title:'חיפה והקריות'}]});
  else if(path===`/${world}/types`)body=JSON.stringify({roomTypes:[],amenities:[],amenity_categories:[]});
  else if(path===`/${world}`)body=JSON.stringify({places:[listing(17),listing(18)]});
  else if(path===`/${world}/17`)body=wire(17);
  else if(path===`/${world}/18`&&(phase===0||membershipChange))body=wire(18);
  else throw Error('unexpected_fixture_fetch:'+path);
  return new Response(body,{headers:{'Content-Type':'application/json'}});
 };
 const first=(await createSergeyPublicCatalogClient({apiKey:'fixture',fetchImpl,now:()=>now}).fetchCandidate(world)).entries;
 if(!membershipChange)first.find(x=>x.supplierId===17).detail._viiCatalog.checkedAt=new Date(now.getTime()-8*86400000).toISOString();
 const before=structuredClone(first.find(x=>x.supplierId===18));phase=1;calls.length=0;
 const next=(await createSergeyPublicCatalogClient({apiKey:'fixture',fetchImpl,now:()=>now,detailRefreshLimit:1}).fetchCandidate(world,first)).entries;
 assert.equal(calls.filter(x=>x===`/${world}/17`).length,membershipChange?0:1);assert.equal(calls.filter(x=>x===`/${world}/18`).length,membershipChange?1:0);
 if(membershipChange){const updated=next.find(x=>x.supplierId===18);assert.deepEqual(updated.detail.rooms.map(r=>r.id),[180,181]);assert.deepEqual(updated.detail.rooms[1].images,['/api/vii/media/new-unit181.jpg']);assert.ok(updated.detailProof);assert.deepEqual(next.find(x=>x.supplierId===17).detail,first.find(x=>x.supplierId===17).detail);return;}
 const retained=next.find(x=>x.supplierId===18);assert.deepEqual(retained.detail,before.detail);
 assert.deepEqual(retained.detail.galleryGroups.map(x=>x.id),['9','2']);assert.deepEqual(retained.detail.rooms[0].galleryGroups.map(x=>x.id),['7']);
 assert.deepEqual(retained.summary.images.map(x=>x.split('/').at(-1)),['new-preview18.jpg','p18-nine.jpg','p18-two.jpg']);
 const expected=await buildApiGalleryContract(world,18,{...parseOrderedJson(wire(18)),representative_galleries:listing(18).galleries});
 assert.equal(compareGalleryContracts(expected,await buildAcceptedGalleryContract(world,retained)).equal,true);
}
for(const world of ['vacations','events']){
 test('regular '+world+' pull retains complete API-owned previews and unrefreshed group metadata',()=>regularCase(world));
 test('regular '+world+' pull prioritizes a newly declared API unit within its existing detail budget',()=>regularCase(world,true));
}
