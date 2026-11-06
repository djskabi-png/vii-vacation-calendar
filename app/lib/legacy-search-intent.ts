import snapshot from "../data/legacy-vacation-intents.generated.json" with {type:"json"};
import {canonicalVacationIntentKey,type VacationIntent} from "./legacy-search-intent-rules.ts";
export {completeLegacySearchFilters,completeLegacySearchSourcePath,semanticVacationFeaturesFromSearchParams,vacationSearchHasTransactionalState} from "./legacy-search-intent-rules.ts";

// Only canonical lookup keys/paths cross the browser boundary. Full legacy
// publication content remains available to server authoring and SEO routes.
const canonicalVacationIntents=new Map<string,string>(snapshot.intents as Array<[string,string]>);

export function canonicalLegacyVacationSearchPath(intent: VacationIntent) {
  if (!intent.features?.length) return null;
  return canonicalVacationIntents.get(canonicalVacationIntentKey(intent)) || null;
}

export function legacyCanonicalIntentCount() {
  return canonicalVacationIntents.size;
}
