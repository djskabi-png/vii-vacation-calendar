import {legacyGalleryFilename} from './legacy-gallery-media.ts';

export type SupplierDetailProof = { supplierId:number; contract:'vii-site-page-v1'; created:string; rawFingerprint:string; normalizedFingerprint:string };
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const amenities=(value:unknown)=>Array.isArray(value)&&value.every(row=>Number.isSafeInteger(row)&&Number(row)>0||object(row)&&Number.isSafeInteger(row.id)&&Number(row.id)>0&&(row.description===undefined||typeof row.description==='string')&&(row.shown===undefined||typeof row.shown==='boolean'));
async function fingerprint(value:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
function galleries(value:unknown, arrayOnly=false){
 if(!Array.isArray(value)&&(!object(value)||arrayOnly))return false;
 if(object(value)&&Object.entries(value).some(([key,row])=>!object(row)||String(row.galleryID)!==key))return false;
 const rows=Array.isArray(value)?value:Object.values(value);
 const ids=new Set<number>();
 return rows.every(row=>{if(!object(row)||!Number.isSafeInteger(row.galleryID)||Number(row.galleryID)<1||ids.has(Number(row.galleryID))||typeof row.title!=='string'||!Array.isArray(row.pictures)||!row.pictures.every(image=>typeof image==='string'&&Boolean(legacyGalleryFilename(image))))return false;ids.add(Number(row.galleryID));return true;});
}
/** The official Site page contract returns everything shown on that place page,
 * unlike the list's six-photo preview. Missing fields never mean deletion. */
export async function proveSupplierDetail(raw:unknown,listPlace:unknown,normalized:unknown,now:Date):Promise<SupplierDetailProof|null>{
 if(!object(raw)||raw.error||!object(listPlace)||!object(normalized)||typeof raw.api_version!=='number'||raw.api_version<1.1||raw.api_version>=2||raw.active!==true||raw.id!==listPlace.siteID||!Number.isSafeInteger(raw.id)||typeof raw.created!=='string')return null;
 const created=Date.parse(raw.created),age=now.getTime()-created;
 if(!Number.isFinite(created)||age< -300_000||age>86_400_000||!galleries(raw.galleries)||!Object.keys(raw.galleries as object).length||!amenities(raw.shared_amenities)||!Array.isArray(raw.rooms)||!Array.isArray(listPlace.rooms))return null;
 const roomIds=new Set<number>();
 for(const room of raw.rooms){if(!object(room)||!Number.isSafeInteger(room.roomID)||Number(room.roomID)<1||roomIds.has(Number(room.roomID))||!galleries(room.galleries,true)||!amenities(room.amenities)||!Array.isArray(room.spaces)||!room.spaces.every(space=>object(space)&&Array.isArray(space.features)&&space.features.every(feature=>object(feature)&&typeof feature.description==='string')))return null;roomIds.add(Number(room.roomID));}
 const listIds=listPlace.rooms.map(room=>object(room)?room.roomID:null);
 if(new Set(listIds).size!==listIds.length||listIds.length!==roomIds.size||listIds.some(id=>!Number.isSafeInteger(id)||!roomIds.has(Number(id))))return null;
 return {supplierId:Number(raw.id),contract:'vii-site-page-v1',created:raw.created,rawFingerprint:await fingerprint(raw),normalizedFingerprint:await fingerprint(normalized)};
}
export async function validSupplierDetailProof(proof:SupplierDetailProof|undefined,entry:{supplierId:number;summary:unknown;detail?:unknown},now:Date){
 if(!proof||proof.contract!=='vii-site-page-v1'||proof.supplierId!==entry.supplierId||!/^[a-f0-9]{64}$/.test(proof.rawFingerprint)||!/^[a-f0-9]{64}$/.test(proof.normalizedFingerprint))return false;
 const age=now.getTime()-Date.parse(proof.created);
 return Number.isFinite(age)&&age>= -300_000&&age<=86_400_000&&proof.normalizedFingerprint===await fingerprint({supplierId:entry.supplierId,summary:entry.summary,detail:entry.detail});
}
