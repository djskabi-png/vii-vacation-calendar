import type {SupplierCatalogEntry,SupplierCatalogWorld} from './supplier-catalog-store.ts';
export type SourceInventoryProof={activeCount:number;previousInactiveIds?:number[];previousInactiveIdsTruncated?:boolean;previousUnknownActivityIds?:number[];previousUnknownActivityIdsTruncated?:boolean};
export function explicitInactiveRemoval(previous:SupplierCatalogEntry[],candidate:SupplierCatalogEntry[],proof?:SourceInventoryProof){
 if(!proof||proof.activeCount!==candidate.length||proof.previousInactiveIdsTruncated!==false||proof.previousUnknownActivityIdsTruncated!==false||!Array.isArray(proof.previousInactiveIds)||!Array.isArray(proof.previousUnknownActivityIds)||proof.previousUnknownActivityIds.length)return false;
 const next=new Set(candidate.map(row=>row.supplierId)),removed=previous.filter(row=>!next.has(row.supplierId)).map(row=>row.supplierId).sort((a,b)=>a-b);
 return JSON.stringify(removed)===JSON.stringify([...proof.previousInactiveIds].sort((a,b)=>a-b));
}
// Exact production comparison reviewed 2026-11-05 against the complete source
// active=false intersection, not the clipped first100 inactive suppliers.
const vacationRemoved=[166,210,213,501,714,727,1029,1031,1094,1156,1172,1175,1199,1201,1260,1470,1529,2055,2151,2156,2168,2226,2264,2401,2432,2433,2441,2456,2469,2503,2517,2569,2591,2593,2595,2596];
const reviewed={
 events:[{before:132,after:127,removed:[210,225,342,727,2168,2508,2570]}],
 vacations:[{before:577,after:547,removed:vacationRemoved},
  // Fresh read-only production comparison 2026-11-05T14:37:52.900Z:
  // 2427 additionally became explicitly inactive; no retained unit was lost.
  {before:577,after:546,removed:[...vacationRemoved,2427].sort((a,b)=>a-b)}],
};
export function reviewedInactiveTransition(world:SupplierCatalogWorld,previous:SupplierCatalogEntry[],candidate:SupplierCatalogEntry[],proof?:SourceInventoryProof){
 if(world!=='events'&&world!=='vacations')return false;
 const next=new Map(candidate.map(row=>[row.supplierId,row]));
 const review=reviewed[world].find(item=>previous.length===item.before&&candidate.length===item.after);
 if(!review||next.size!==candidate.length||!explicitInactiveRemoval(previous,candidate,proof))return false;
 const removed=previous.filter(row=>!next.has(row.supplierId)).map(row=>row.supplierId).sort((a,b)=>a-b);
 if(JSON.stringify(removed)!==JSON.stringify(review.removed))return false;
 // Whole inactive places only; no unit removal from a retained place.
 return previous.every(row=>{const updated=next.get(row.supplierId);if(!updated)return true;
  const before=(row.detail as {rooms?:Array<{id:number}>})?.rooms||[],after=new Set(((updated.detail as {rooms?:Array<{id:number}>})?.rooms||[]).map(room=>room.id));return before.every(room=>after.has(room.id));});
}
