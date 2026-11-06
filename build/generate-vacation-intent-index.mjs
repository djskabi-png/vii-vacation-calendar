import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildLegacyVacationIntentIndex} from '../app/lib/legacy-search-intent-source.ts';
import verified from '../app/data/verified-catalog.json' with {type:'json'};
import retired from '../app/data/retired-place-routes.json' with {type:'json'};
import {supplierLegacySlug,unavailableLegacyPlace} from '../app/data/supplier-legacy-links-source.ts';

export function vacationIntentIndexBytes(){return JSON.stringify({schemaVersion:1,intents:[...buildLegacyVacationIntentIndex()]})+'\n';}
export function supplierLegacyIndexBytes(){
 const aliases={vacations:Object.create(null),events:Object.create(null)},unavailable={vacations:Object.create(null),events:Object.create(null)};
 for(const world of ['vacations','events']){
  const ids=[...new Set([...(world==='vacations'?verified.vacation:verified.events).map(x=>x.id),...retired.filter(x=>x.world===world).map(x=>x.slug)])].sort();
  for(const id of ids){const alias=supplierLegacySlug(id,world),place=unavailableLegacyPlace(id,world);if(alias)aliases[world][id]=alias;if(place)unavailable[world][id]=place;}
 }
 return JSON.stringify({schemaVersion:1,aliases,unavailable})+'\n';
}
const outputs=[['legacy-vacation-intents.generated.json',vacationIntentIndexBytes],['supplier-legacy-links.generated.json',supplierLegacyIndexBytes]];
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 if(!['--check','--write'].includes(process.argv[2])){console.error('Explicit --check or --write required');process.exitCode=1;}
 else for(const [name,generate]of outputs){
  const expected=generate(),output=fileURLToPath(new URL('../app/data/'+name,import.meta.url));
  if(process.argv[2]==='--write'){await writeFile(output,expected);console.log(JSON.stringify({status:'generated',name,bytes:Buffer.byteLength(expected)}));}
  else{let actual;try{actual=await readFile(output,'utf8');}catch{}if(actual!==expected){console.error('client_lookup_stale:'+name+': run generator --write, review and commit before building');process.exitCode=1;}}
 }
}
