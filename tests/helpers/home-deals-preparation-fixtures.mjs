import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {regionalAvailabilityRegion,selectRegionalOffers} from '../../app/lib/regional-availability.ts';
import {eligibleDealDate} from '../../app/lib/deal-clock.ts';
import {prioritizeOnlineFirst,isHomeDealOnlineEligible} from '../../app/lib/vacation-online-first.ts';
import {compareVacationPriority} from '../../app/lib/vacation-priority.ts';

// Execute the actual shared projection against the harness's existing database
// and provider fixtures. Do not replace the new production selector with a copy.
export function homeDealsPreparation(dependencies) {
 const source=readFileSync(new URL('../../app/lib/home-deals-snapshot.ts',import.meta.url),'utf8');
 const js=stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm,''),{mode:'strip'}).replace(/^export /gm,'');
 const deps={runtimeDatabase:async()=>null,regionalAvailabilityRegion,selectRegionalOffers,eligibleDealDate,prioritizeOnlineFirst,isHomeDealOnlineEligible,compareVacationPriority,...dependencies};
 return new Function(...Object.keys(deps),`${js};return {applyHomeDealsCuration,selectHomeDeals,readHomeDealsSnapshot};`)(...Object.values(deps));
}
