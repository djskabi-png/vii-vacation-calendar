import {canonicalLocationDestination} from './canonical-location-redirect.ts';
import {supplierAmenityFilters} from './supplier-amenity-filters.ts';
import {legacyAccommodationTypeOptions} from './legacy-accommodation-type-options.ts';
export const legacySearchStateKeys=['from','till','to','dates','guests','adults','children','infants','pets','rooms','roomID','price','minPrice','maxPrice','sort'];
/** Shared by the inventory generator and runtime, so generated redirects
 * already contain the direct semantic destination rather than an old alias. */
export function canonicalLegacyTarget(input:URL|string,target:string):string {
 const source=input instanceof URL?input:new URL(input,'https://www.vii.co.il');
 const destination=new URL(target,'https://vii.spaplus.co');
 if(destination.origin!=='https://vii.spaplus.co')return target;
 if(/^\/(?:events\/)?s(?:\/|$)/i.test(source.pathname)){
  for(const key of legacySearchStateKeys){const value=source.searchParams.get(key);if(value)destination.searchParams.set(key,value);}
  if(destination.pathname==='/search'){
   const typeIds=[...source.searchParams.getAll('roomTypes'),...source.searchParams.getAll('roomTypes[]')].flatMap(value=>value.split(/[-,]/));
   const types=[...new Set(typeIds.flatMap(id=>legacyAccommodationTypeOptions.find(([number])=>String(number)===id)?.[1]||[]))];
   if(types.length){destination.searchParams.delete('type');destination.searchParams.set('types',types.join(','));}
   // Verified live old-page title on 2026-11-05: Ra'anana with a pool.
   // This city currently has no approved vacation landing; retain its query.
   if(source.searchParams.get('sett')==='1244'&&!destination.searchParams.has('location'))destination.searchParams.set('location','רעננה');
   const features=new Set((destination.searchParams.get('features')||'').split(',').filter(Boolean));
   for(const rawId of (source.searchParams.get('attr')||'').split('-')){
    if(!/^[1-9]\d*$/.test(rawId))continue;
    const item=supplierAmenityFilters.find(item=>item.id===Number(rawId));if(!item)continue;
    if(item.filterId==='pool')destination.searchParams.set('pool','1');
    else if(item.filterId==='accessible')destination.searchParams.set('accessible','1');
    else features.add(item.filterId);
   }
   if(features.size)destination.searchParams.set('features',[...features].join(','));
  }
 }
 if(/^\/(?:business(?:\?|$)|events\/place\/|discover\/place\/)/.test(`${destination.pathname}${destination.search}`)){
  for(const key of [...legacySearchStateKeys,'date']){const value=source.searchParams.get(key);if(value)destination.searchParams.set(key,value);}
 }
 const canonical=canonicalLocationDestination(destination)||destination;
 return `${canonical.pathname}${canonical.search}${canonical.hash}`;
}
