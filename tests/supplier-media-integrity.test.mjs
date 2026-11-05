import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogContentIntegrityIssues } from "../app/lib/supplier-catalog-sync.ts";
import { createSergeyPublicCatalogClient } from "../app/lib/sergey-public-catalog-client.ts";

const entry = (image) => ({ supplierId: 1, summary: { name: "x" }, detail: { images: [image], rooms: [{ id: 9, images: [image], features: ["pool"] }], galleryGroups: [{ title: "main", images: [image] }] } });

test("legacy and local media aliases are one image identity", () => {
  assert.deepEqual(catalogContentIntegrityIssues("events", [entry("https://www.vii.co.il/gallery/469.jpg")], [entry("/api/vii/media/469.jpg")]), []);
});

test("true image removal remains blocked while unknown hosts stay strict", () => {
  assert.ok(catalogContentIntegrityIssues("events", [entry("https://www.vii.co.il/gallery/469.jpg")], [entry("https://www.vii.co.il/gallery/470.jpg")]).length > 0);
  assert.ok(catalogContentIntegrityIssues("events", [entry("https://evil.example/469.jpg")], [entry("https://other.example/469.jpg")]).length > 0);
});

test("recognized media filenames remain case-sensitive", () => {
  assert.ok(catalogContentIntegrityIssues("events", [entry("https://www.vii.co.il/gallery/Foo.jpg")], [entry("/api/vii/media/foo.jpg")]).length > 0);
});

test("only the explicitly quarantined trusted supplier image can be removed by that policy",()=>{
  const old=entry('/api/vii/media/good.jpg');
  old.detail.images.push('https://www.vii.co.il/gallery/796a2fc6bf52100.png');
  old.detail.galleryGroups.push({title:'notice',images:['/api/vii/media/796a2fc6bf52100.png']});
  old.detail.rooms[0].images.push('/api/vii/media/796a2fc6bf52100.png');
  assert.deepEqual(catalogContentIntegrityIssues('events',[old],[entry('/api/vii/media/good.jpg')]),[]);
  old.detail.images.push('https://unknown.example/gallery/796a2fc6bf52100.png');
  assert.ok(catalogContentIntegrityIssues('events',[old],[entry('/api/vii/media/good.jpg')]).some(x=>x.path==='detail.images'));
});

test('production media identity survives the real provider normalization boundary',async()=>{
  // Public media identities from the verified active snapshot, no customer payload.
  const names=['469cbad3587de0.png','7269cbad36cd4c6.jpg','4866c5e99ec5292.jpg'];
  const old={supplierId:1857,summary:{name:'Fixture'},detail:{images:names.map(n=>'https://www.vii.co.il/gallery/'+n),rooms:[{id:3173,images:names.slice(1).map(n=>'https://www.vii.co.il/gallery/'+n),features:[]}],galleryGroups:[{title:'main',images:names.map(n=>'https://www.vii.co.il/gallery/'+n)}]}};
  const raw={id:1857,active:true,name:'Fixture',location:{city:1},galleries:{main:{title:'main',pictures:names.map(n=>'/gallery/'+n)}},rooms:[{roomID:3173,roomName:'unit',roomCount:1,maxGuests:2,galleries:[{pictures:names.slice(1).map(n=>'/gallery/'+n)}]}]};
  const fetchImpl=async url=>{
    const path=new URL(url).pathname.replace('/api/ai/vii','');
    return Response.json(path==='/locations'?{cities:[{id:1,title:'fixture',area:2}],areas:[{id:2,title:'fixture'}]}:path==='/events/types'?{}:path==='/events'?{places:[{siteID:1857,active:true}]}:raw);
  };
  const candidate=await createSergeyPublicCatalogClient({apiKey:'fixture',fetchImpl}).fetchCandidate('events',[old]);
  assert.equal(candidate.entries[0].detail.images[0],'/api/vii/media/'+names[0]);
  assert.deepEqual(catalogContentIntegrityIssues('events',[old],candidate.entries),[]);
});
