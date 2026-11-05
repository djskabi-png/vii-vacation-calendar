import assert from "node:assert/strict";
import { test } from "node:test";
import { supplierDetailProofIssue, proveSupplierDetail } from "../app/lib/supplier-detail-contract.ts";
const now = new Date("2026-11-05T12:00:00Z");
const list = { siteID: 12, rooms: [{ roomID: 7 }] };
const raw = { api_version: 1.2, active: true, id: 12, created: "2026-11-05T11:00:00Z", galleries: { "1": { galleryID: 1, title: "Main", pictures: ["https://www.vii.co.il/gallery/a.jpg"] } }, shared_amenities: [4], rooms: [{ roomID: 7, galleries: [{ galleryID: 2, title: "Room", pictures: ["https://www.vii.co.il/gallery/b.jpg"] }], amenities: [5], spaces: [{ features: [{ description: "x" }] }] }] };
test("detail proof exposes stable issue codes for protocol, media and room schemas", async () => {
  assert.equal(supplierDetailProofIssue({ ...raw, api_version: 2 }, list, now), "protocol_version");
  assert.equal(supplierDetailProofIssue({ ...raw, galleries: { "1": { galleryID: 1, title: "Main", pictures: ["https://evil.example/a.jpg"] } } }, list, now), "site_gallery_schema");
  assert.equal(supplierDetailProofIssue({ ...raw, rooms: [{ ...raw.rooms[0], spaces: [{ features: [{ bad: true }] }] }] }, list, now), "room_spaces_schema");
  assert.equal(supplierDetailProofIssue({ ...raw, created: "2027-01-01T00:00:00Z" }, list, now), "detail_age");
});
test("valid detail proves and invalid room identity does not", async () => {
  const proof = await proveSupplierDetail(raw, list, { supplierId: 12, summary: {}, detail: raw }, now);
  assert.ok(proof);
  assert.equal(supplierDetailProofIssue({ ...raw, rooms: [{ ...raw.rooms[0], roomID: 8 }] }, list, now), "room_identity_mismatch");
});

test('room amenity diagnostics identify the invalid field without relaxing any proof predicate',async()=>{
 for(const [amenities,code] of [[null,'room_amenities_array'],[{id:'5'},'room_amenities_array'],[[{id:'5'}],'room_amenities_identity'],[[{id:5,description:null}],'room_amenities_description'],[[{id:5,shown:1}],'room_amenities_shown']]){
  const value={...raw,rooms:[{...raw.rooms[0],amenities}]};assert.equal(supplierDetailProofIssue(value,list,now),code);assert.equal(await proveSupplierDetail(value,list,{},now),null);
 }
 assert.equal(supplierDetailProofIssue({...raw,rooms:[{...raw.rooms[0],amenities:[{id:5,shown:false,description:''}]}]},list,now),null);
});
