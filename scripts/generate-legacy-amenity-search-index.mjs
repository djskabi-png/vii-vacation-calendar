import fs from 'node:fs';
import groups from '../app/data/legacy-place-feature-groups.json' with {type:'json'};
import {filterIdsFromStructuredAmenityLabels,amenityBaseLabel,filterIdsFromVerifiedLegacyIds} from '../app/lib/supplier-amenity-filters.ts';

const entries={};
for(const [slug,sourceGroups] of Object.entries(groups.groups)){
 if(!/^vacation-[1-9]\d*$/.test(slug))throw Error('invalid_legacy_profile_identity');
 const filters=[...new Set(sourceGroups.flatMap(group=>filterIdsFromStructuredAmenityLabels(group.items,group.title)))].sort();
 const accessibility=sourceGroups.flatMap(group=>group.items).filter(label=>amenityBaseLabel(label)==='נגישות לנכים');
 const ids=filters.filter(id=>id.startsWith('amenity-')).map(id=>Number(id.slice(8))).sort((a,b)=>a-b);
 const covered=new Set(filterIdsFromVerifiedLegacyIds(ids));
 const extra=filters.filter(id=>!covered.has(id));
 entries[slug]={ids,...(extra.length?{extra}: {}),...(accessibility.length?{accessibility}: {})};
}
const output={schemaVersion:1,source:groups.source,sourceGeneration:groups.migratedAt,profileCount:Object.keys(entries).length,entries};
const serialized=JSON.stringify(output)+'\n';
if(Buffer.byteLength(serialized)>180000)throw Error('legacy_search_index_budget_exceeded');
fs.writeFileSync(new URL('../app/data/legacy-amenity-search-index.json',import.meta.url),serialized);
console.log(JSON.stringify({profiles:output.profileCount,bytes:Buffer.byteLength(serialized),accessible:Object.values(entries).filter(x=>x.accessibility?.length).length}));
