import {legacyGalleryFilename, isQuarantinedGalleryMedia} from './legacy-gallery-media.ts';

export type SupplierDetailProof = { supplierId:number; contract:'vii-site-page-v1'|'vii-site-media-v1'; created:string; rawFingerprint:string; normalizedFingerprint:string; previousFingerprint?:string };
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
function amenityIssue(value:unknown):string|null {
 if(!Array.isArray(value))return 'array';
 for(const row of value){
  if(Number.isSafeInteger(row)&&Number(row)>0)continue;
  if(!object(row)||!Number.isSafeInteger(row.id)||Number(row.id)<1)return 'identity';
  if(row.description!==undefined&&typeof row.description!=='string')return 'description';
  if(row.shown!==undefined&&typeof row.shown!=='boolean')return 'shown';
 }
 return null;
}
async function fingerprint(value:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
export function supplierEntryFingerprint(entry:{supplierId:number;summary:unknown;detail?:unknown}){return fingerprint({supplierId:entry.supplierId,summary:entry.summary,detail:entry.detail});}
function galleries(value:unknown, arrayOnly=false, allowQuarantine=false){
 if(!Array.isArray(value)&&(!object(value)||arrayOnly))return false;
 if(object(value)&&Object.entries(value).some(([key,row])=>!object(row)||String(row.galleryID)!==key))return false;
 const rows=Array.isArray(value)?value:Object.values(value);
 const ids=new Set<number>();
 return rows.every(row=>{if(!object(row)||!Number.isSafeInteger(row.galleryID)||Number(row.galleryID)<1||ids.has(Number(row.galleryID))||typeof row.title!=='string'||!Array.isArray(row.pictures)||!row.pictures.every(image=>typeof image==='string'&&(Boolean(legacyGalleryFilename(image))||(allowQuarantine&&isQuarantinedGalleryMedia(image)))))return false;ids.add(Number(row.galleryID));return true;});
}
function mediaIssue(raw:unknown,listPlace:unknown,now:Date):string|null {
 if(!object(raw)||raw.error)return 'detail_schema'; if(!object(listPlace))return 'list_schema';
 if(typeof raw.api_version!=='number'||raw.api_version<1.1||raw.api_version>=2)return 'protocol_version';
 if(raw.active!==true)return 'site_inactive'; if(!Number.isSafeInteger(raw.id)||raw.id!==listPlace.siteID)return 'detail_identity_mismatch';
 if(typeof raw.created!=='string')return 'created_missing'; const created=Date.parse(raw.created),age=now.getTime()-created;
 if(!Number.isFinite(created)||age< -300_000||age>86_400_000)return 'detail_age';
 if(!galleries(raw.galleries,false,true)||!Object.keys(raw.galleries as object).length)return 'site_gallery_schema';
 if(!Array.isArray(raw.rooms)||!Array.isArray(listPlace.rooms))return 'room_set_schema'; const ids=new Set<number>();
 for(const room of raw.rooms){if(!object(room)||!Number.isSafeInteger(room.roomID)||Number(room.roomID)<1||ids.has(Number(room.roomID)))return 'room_identity_mismatch';if(!galleries(room.galleries,true,true))return 'room_gallery_schema';ids.add(Number(room.roomID));}
 const listIds=listPlace.rooms.map(room=>object(room)&&Number.isSafeInteger(room.roomID)?Number(room.roomID):null);
 if(new Set(listIds).size!==listIds.length||listIds.length!==ids.size||listIds.some(id=>id===null||!ids.has(id)))return 'room_identity_mismatch';
 return null;
}
export function supplierDetailProofIssue(raw:unknown,listPlace:unknown,now:Date):string|null {
 if(!object(raw)||raw.error)return "detail_schema";
 if(!object(listPlace))return "list_schema";
 if(typeof raw.api_version!=="number"||raw.api_version<1.1||raw.api_version>=2)return "protocol_version";
 if(raw.active!==true)return "site_inactive";
 if(!Number.isSafeInteger(raw.id)||raw.id!==listPlace.siteID)return "detail_identity_mismatch";
 if(typeof raw.created!=="string")return "created_missing";
 const created=Date.parse(raw.created),age=now.getTime()-created;
 if(!Number.isFinite(created)||age< -300_000||age>86_400_000)return "detail_age";
 if(!galleries(raw.galleries)||!Object.keys(raw.galleries as object).length)return "site_gallery_schema";
 if(amenityIssue(raw.shared_amenities))return "site_amenities_schema";
 if(!Array.isArray(raw.rooms)||!Array.isArray(listPlace.rooms))return "room_set_schema";
 const roomIds=new Set<number>();
 for(const room of raw.rooms){if(!object(room)||!Number.isSafeInteger(room.roomID)||Number(room.roomID)<1||roomIds.has(Number(room.roomID)))return "room_identity_mismatch";if(!galleries(room.galleries,true))return "room_gallery_schema";const issue=amenityIssue(room.amenities);if(issue)return `room_amenities_${issue}`;if(!Array.isArray(room.spaces)||!room.spaces.every(space=>object(space)&&Array.isArray(space.features)&&space.features.every(feature=>object(feature)&&typeof feature.description==='string')))return "room_spaces_schema";roomIds.add(Number(room.roomID));}
 const listIds=listPlace.rooms.map(room=>object(room)&&Number.isSafeInteger(room.roomID)?Number(room.roomID):null);
 if(new Set(listIds).size!==listIds.length||listIds.length!==roomIds.size||listIds.some(id=>id===null||!roomIds.has(id)))return "room_identity_mismatch";
 return null;
}
export function supplierNonMediaFactsMatch(a:unknown,b:unknown):boolean {
 const project=(value:unknown):unknown=>{if(!object(value))return value;const out=structuredClone(value);delete out.detailProof;
  if(object(out.summary)){delete out.summary.image;delete out.summary.images;delete out.summary.previewText;}
  if(object(out.detail)){delete out.detail.images;delete out.detail.galleryGroups;delete out.detail._viiCatalog;
   if(Array.isArray(out.detail.rooms))for(const room of out.detail.rooms)if(object(room)){delete room.images;delete room.galleryGroups;}
  } return out;};
 return JSON.stringify(project(a))===JSON.stringify(project(b));
}
export async function proveSupplierMediaDetail(raw:unknown,listPlace:unknown,composite:unknown,previous:unknown,now:Date):Promise<SupplierDetailProof|null>{
 if(mediaIssue(raw,listPlace,now)||!object(composite)||!object(previous)||!supplierNonMediaFactsMatch(composite,previous))return null;
 const rawRecord = raw as Record<string, unknown>;
 const supplierId = composite.supplierId;
 const previousSupplierId = previous.supplierId;
 const rawId = rawRecord.id;
 if(typeof supplierId!=="number"||!Number.isSafeInteger(supplierId)||supplierId<1||typeof rawId!=="number"||supplierId!==rawId||typeof previousSupplierId!=="number"||!Number.isSafeInteger(previousSupplierId)||previousSupplierId<1||previousSupplierId!==supplierId)return null;
 const currentEntry = { supplierId, summary: composite.summary, detail: composite.detail };
 const previousEntry = { supplierId: previousSupplierId, summary: previous.summary, detail: previous.detail };
 return {supplierId,contract:'vii-site-media-v1',created:String(rawRecord.created),rawFingerprint:await fingerprint(raw),normalizedFingerprint:await supplierEntryFingerprint(currentEntry),previousFingerprint:await supplierEntryFingerprint(previousEntry)};
}
/** The official Site page contract returns everything shown on that place page,
 * unlike the list's six-photo preview. Missing fields never mean deletion. */
export async function proveSupplierDetail(raw:unknown,listPlace:unknown,normalized:unknown,now:Date):Promise<SupplierDetailProof|null>{
 if(supplierDetailProofIssue(raw,listPlace,now)||!object(raw)||typeof raw.created!=='string'||!object(normalized))return null;
 return {supplierId:Number(raw.id),contract:'vii-site-page-v1',created:raw.created,rawFingerprint:await fingerprint(raw),normalizedFingerprint:await fingerprint(normalized)};
}
export async function validSupplierDetailProof(proof:SupplierDetailProof|undefined,entry:{supplierId:number;summary:unknown;detail?:unknown},now:Date,previous?:{supplierId:number;summary:unknown;detail?:unknown}){
 if(proof?.contract==='vii-site-media-v1')return Boolean(previous&&proof.supplierId===entry.supplierId&&supplierNonMediaFactsMatch(entry,previous)&&proof.previousFingerprint===await supplierEntryFingerprint(previous)&&/^[a-f0-9]{64}$/.test(proof.rawFingerprint)&&/^[a-f0-9]{64}$/.test(proof.normalizedFingerprint)&&proof.normalizedFingerprint===await supplierEntryFingerprint(entry)&&(()=>{const age=now.getTime()-Date.parse(proof.created);return Number.isFinite(age)&&age>=-300000&&age<=86400000;})());
 if(!proof||proof.contract!=='vii-site-page-v1'||proof.supplierId!==entry.supplierId||!/^[a-f0-9]{64}$/.test(proof.rawFingerprint)||!/^[a-f0-9]{64}$/.test(proof.normalizedFingerprint))return false;
 const age=now.getTime()-Date.parse(proof.created);
 return Number.isFinite(age)&&age>= -300_000&&age<=86_400_000&&proof.normalizedFingerprint===await supplierEntryFingerprint(entry);
}
