import assert from "node:assert/strict";
import test from "node:test";
import { patchGalleryMedia } from "../app/lib/gallery-media-patch.ts";
const entry = (id, summary, detail) => ({ supplierId: id, summary, ...(detail ? { detail } : {}) });
test("vacation patch preserves nested nonmedia and child order", () => { const c=entry(7,{name:"keep",image:"/old"},{images:["/old"],rooms:[{id:2,name:"A",images:["/old-r"]},{id:3,name:"B",images:[]}]}); const n=entry(7,{name:"new",image:"/new"},{images:["/new"],rooms:[{id:2,name:"X",images:["/new-r"]},{id:3,name:"X",images:["/new-r2"]}]}); const out=patchGalleryMedia("vacations",c,n); assert.equal(out.summary.name,"keep"); assert.deepEqual(out.detail.rooms.map(r=>r.id),[2,3]); assert.deepEqual(out.detail.rooms[0].images,["/new-r"]); });
test("hourly and spa patch media only", () => { const h=patchGalleryMedia("rooms",entry(8,{label:"keep",images:["old"],rooms:[{id:4,name:"R",images:["old-r"]}]}),entry(8,{label:"new",images:["new"],rooms:[{id:4,name:"X",images:["new-r"]}]})); assert.equal(h.summary.label,"keep"); assert.deepEqual(h.summary.rooms[0].images,["new-r"]); const s=patchGalleryMedia("spa",entry(9,{title:"keep",image:"old",packages:[{id:12,title:"P",image:"old-p"}]}),entry(9,{title:"new",image:"new",packages:[{id:12,title:"X",image:"new-p"}]})); assert.equal(s.summary.title,"keep"); assert.equal(s.summary.packages[0].image,"new-p"); });
test("foreign, missing and duplicate children are rejected", () => { assert.throws(()=>patchGalleryMedia("vacations",entry(1,{}, {rooms:[{id:2}]}),entry(2,{}, {rooms:[{id:2}]})),/foreign/); assert.throws(()=>patchGalleryMedia("rooms",entry(1,{rooms:[{id:2},{id:2}]}),entry(1,{rooms:[{id:2},{id:2}]})),/invalid_gallery_child_ids/); });
test('SPA gallery owners follow API package order while each accepted package keeps its facts',()=>{
 const before=entry(9,{title:'Keep',image:'old',packages:[{id:3,title:'Three',price:300,image:'old3'},{id:7,title:'Seven',price:700,image:'old7'}]});
 const normalized=entry(9,{title:'Changed',image:'new',packages:[{id:7,title:'Wrong',price:1,image:'new7'},{id:3,title:'Wrong',price:1,image:'new3'}]});
 const out=patchGalleryMedia('spa',before,normalized);assert.deepEqual(out.summary.packages.map(p=>[p.id,p.title,p.price,p.image]),[[7,'Seven',700,'new7'],[3,'Three',300,'new3']]);assert.equal(out.summary.title,'Keep');
});
