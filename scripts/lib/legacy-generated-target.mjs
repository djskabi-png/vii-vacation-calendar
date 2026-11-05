import {canonicalLegacyTarget} from '../../app/lib/legacy-target-policy.ts';
import {canonicalLegacyVacationSearchPath,semanticVacationFeaturesFromSearchParams} from '../../app/lib/legacy-search-intent.ts';
/** Build-time only: the full editorial intent index must not enter Worker
 * startup merely to serve a redirect. Store its approved result in inventory. */
export function canonicalGeneratedLegacyTarget(source,target){
 const normalized=canonicalLegacyTarget(source,target),url=new URL(normalized,'https://vii.spaplus.co');
 if(url.pathname!=='/search')return normalized;
 const types=(url.searchParams.get('types')||url.searchParams.get('type')||'').split(',').filter(Boolean);
 if(types.length>1)return normalized;
 const path=canonicalLegacyVacationSearchPath({location:url.searchParams.get('location')||'כל הארץ',type:types[0]||'',features:semanticVacationFeaturesFromSearchParams(url.searchParams)});
 if(!path)return normalized;
 for(const key of ['location','type','types','features','pool','accessible'])url.searchParams.delete(key);
 return `${path}${url.searchParams.size?`?${url.searchParams}`:''}`;
}
