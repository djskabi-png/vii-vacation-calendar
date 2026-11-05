import approvedLocations from '../data/approved-world-locations.json' with {type:'json'};
import {worldLocationSlug} from './location-slug.ts';
type World=keyof typeof approvedLocations;
const routes:Record<string,{world:World;base:string}>={
 '/search':{world:'vacation',base:'/vacations/search'},
 '/events/search':{world:'events',base:'/events/search'},
 '/spas':{world:'spa',base:'/spas/search'},
 '/hourly':{world:'hourly',base:'/hourly/search'},
};
/** The same approved location rule applies to a direct query and a redirect
 * destination, so a legacy link never needs a second normalization redirect. */
export function canonicalLocationDestination(input:URL):URL|null {
 const path=input.pathname.replace(/\/$/,'')||'/',route=routes[path],location=input.searchParams.get('location')?.trim();
 if(!route||!location||!approvedLocations[route.world].includes(location)
  ||route.world==='vacation'&&(input.searchParams.has('type')||input.searchParams.has('types')))return null;
 const destination=new URL(input);destination.pathname=`${route.base}/${worldLocationSlug(location)}`;destination.searchParams.delete('location');return destination;
}
