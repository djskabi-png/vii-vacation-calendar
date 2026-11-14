import {spaDealDays} from '../../app/lib/spa-deal-window.ts';
import {spaSliderRepresentatives,orderSpaDealExposure,selectSpaCatalogPackages} from '../../app/lib/spa-package-deals.ts';
import {firstDealDate} from '../../app/lib/deal-clock.ts';
import {spaDiscoveryAvailabilityCacheKey} from '../../app/lib/spa-discovery-cache-key.ts';

// Share actual route dependencies across extracted-handler tests. Catalog,
// availability and time remain explicit, isolated inputs of each scenario.
export function spaDealRouteDependencies(dependencies){
 return {spaDealDays,spaSliderRepresentatives,orderSpaDealExposure,selectSpaCatalogPackages,firstDealDate,spaDiscoveryAvailabilityCacheKey,
  verifiedPublicDiscoveryHeaders:()=>({"Cache-Control":"no-store"}),
  readActivePromotionWeights:async()=>[],runtimeCatalogDatabase:async()=>null,getRequestExecutionContext:()=>null,
  ...dependencies};
}

export {spaDealDays};
