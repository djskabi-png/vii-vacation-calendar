import {vacationRegions} from '../data/vacation-landings.ts';
import {curatedVacationSearchPages} from '../data/curated-vacation-search-pages.ts';
type Filters=Record<string,string|number|boolean>;
const transient=new Set(['date','from','to','till','checkin','checkout','guests','adults','children','infants','rooms','bedrooms','minPrice','maxPrice','sort','view','map','page','online','language','lang']);
function source(value:string,locale:string){
 if(!['he','en','fr','ru'].includes(locale))return null;
 let url:URL;try{url=new URL(value,'https://vii.spaplus.co');}catch{return null;}
 if(!value.startsWith('/')||value.startsWith('//'))return null;
 const match=url.pathname.match(/^\/(en|fr|ru)(?=\/)/);if(match&&match[1]!==locale)return null;
 return {path:url.pathname.replace(/^\/(?:en|fr|ru)(?=\/)/,'').replace(/\/$/,'')||'/',query:Object.fromEntries([...url.searchParams].filter(([key])=>!key.startsWith('utm_')&&!transient.has(key)))};
}
function signature(values:Filters){
 const hard:Record<string,string>={},features=new Set<string>();
 for(const [key,raw]of Object.entries(values)){
  if(transient.has(key)||key.startsWith('utm_')||raw===''||raw==null)continue;
  if(key==='features'){for(const value of String(raw).split(',').map(value=>value.trim()).filter(Boolean))features.add(value);continue;}
  if(['pool','accessible'].includes(key)&&(raw===true||String(raw)==='1')){features.add(key);continue;}
  hard[key]=String(raw);
 }
 if(features.size)hard.features=[...features].sort().join(',');
 return JSON.stringify(Object.entries(hard).sort(([a],[b])=>a.localeCompare(b)));
}
/** A real existing route is distinct from a demand item's editorial status. */
export function approvedVacationPage(sourcePath:string,filters:Filters={},locale='he'):string|null{
 const parsed=source(sourcePath,locale);if(!parsed)return null;
 const values={...parsed.query,...filters},requestedLocation=values.location,region=vacationRegions.find(region=>'/vacations/'+region.slug===parsed.path);
 if(region&&values.location&&![region.slug,region.label].includes(String(values.location)))return null;
 delete values.location;
 const actual=signature(values),prefix=locale==='he'?'':'/'+locale;
 if(region&&actual==='[]')return prefix+parsed.path;
 for(const page of curatedVacationSearchPages){
  const candidate=source(page.sourcePath,'he');if(!candidate)continue;
  if(parsed.path!==candidate.path&&parsed.path!==page.canonicalPath)continue;
  const pageRegion=vacationRegions.find(region=>region.label===page.location);
  if(requestedLocation&&![page.location,pageRegion?.slug].includes(String(requestedLocation)))continue;
  const expected=signature(page.filters);
  if(actual===expected||(parsed.path===page.canonicalPath&&actual==='[]'))return prefix+page.canonicalPath;
 }
 return null;
}
export function approvedVacationSourcePath(sourcePath:string,filters:Filters={},locale='he'){return approvedVacationPage(sourcePath,filters,locale)!==null;}

export function searchApprovalFingerprint(sourcePath:string,filters:Filters={},locale='he'){
 const parsed=source(sourcePath,locale);return parsed?parsed.path+'|'+signature({...parsed.query,...filters}):null;
}
