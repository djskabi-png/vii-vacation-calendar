import type {SearchMode} from '../data/search-taxonomy.ts';
import {worldLocationSlug} from './location-slug.ts';

const basePath:Record<SearchMode,string>={vacation:'/vacations/search',events:'/events/search',spa:'/spas/search',hourly:'/hourly/search'};
export {worldLocationSlug};
/** Browser-safe URL construction. Inventory reads belong to the server module. */
export function worldLocationPath(mode:SearchMode,label:string){return `${basePath[mode]}/${worldLocationSlug(label)}`;}
