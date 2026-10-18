const ROOT='https://bizonline.co.il/api/ai/vii';
const ENDPOINTS=['locations','vacations'];
const MAX=2*1024*1024;
const KNOWN=['cities','areas','districts','unassigned','places','data','error','message'];
const TYPES=new Set(['application/json','application/problem+json','text/json','text/html','text/plain']);
const record=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const array=x=>Array.isArray(x)?x:null;
const fault=kind=>Object.assign(Error('catalog_source_unavailable'),{kind});
export function catalogSourceShape(value){
 const o=record(value),data=record(o.data),places=array(o.places)||[];
 const active=places.filter(p=>record(p).active===true);
 const validIds=active.map(p=>record(p).siteID).filter(id=>Number.isSafeInteger(id)&&id>0);
 const types={number:0,string:0,missing:0,other:0};
 for(const p of active){const item=record(p);types[!Object.hasOwn(item,'siteID')?'missing':typeof item.siteID==='number'?'number':typeof item.siteID==='string'?'string':'other']++;}
 return {topLevelKind:Array.isArray(value)?'array':value===null?'null':typeof value==='object'?'object':typeof value,
  presence:Object.fromEntries(KNOWN.map(k=>[k,Object.hasOwn(o,k)])),unknownKeyCount:Object.keys(o).filter(k=>!KNOWN.includes(k)).length,
  expectedArrays:{cities:!!array(o.cities),areas:!!array(o.areas),places:!!array(o.places)},
  wrappedDataArrays:{cities:!!array(data.cities),areas:!!array(data.areas),places:!!array(data.places)},
  counts:{cities:array(o.cities)?.length??null,areas:array(o.areas)?.length??null,places:array(o.places)?.length??null},
  active:{strictTrue:active.length,numeric:places.filter(p=>typeof record(p).active==='number').length,string:places.filter(p=>typeof record(p).active==='string').length},
  activeSiteID:{types,invalidPositive:active.length-validIds.length,duplicates:validIds.length-new Set(validIds).size}};
}
export async function fetchCatalogSourcePreflight({apiKey,fetchImpl=fetch,now=Date.now,deadlineMs=8000}={}){
 if(typeof apiKey!=='string'||!apiKey.trim()||apiKey.length>2048||!/^[\x21-\x7e]+$/.test(apiKey)||typeof fetchImpl!=='function'||typeof now!=='function'||!Number.isInteger(deadlineMs)||deadlineMs<1||deadlineMs>8000)throw Error('invalid_probe_configuration');
 const observedAt=new Date(now()).toISOString();
 const results=await Promise.all(ENDPOINTS.map(async name=>{
  const started=Date.now(),controller=new AbortController();let timer,reader;
  const timed=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(fault('timed_out'));},deadlineMs);});
  const action=(async()=>{
   const response=await fetchImpl(`${ROOT}/${name}`,{method:'GET',headers:{Authorization:`Bearer ${apiKey}`,Accept:'application/json'},credentials:'omit',redirect:'manual',cache:'no-store',signal:controller.signal});
   const rawType=(response.headers.get('content-type')||'').split(';',1)[0].trim().toLowerCase();
   const contentType=!rawType?null:TYPES.has(rawType)?rawType:'other',status=response.status;
   if(status!==200){await response.body?.cancel().catch(()=>{});return {status,contentType,parseKind:'not_read',metadata:null};}
   const size=response.headers.get('content-length');if(size!==null&&(!/^\d+$/.test(size)||Number(size)>MAX))throw fault('oversize');
   if(!response.body)throw fault('invalid_json');reader=response.body.getReader();const chunks=[];let bytes=0;
   for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>MAX)throw fault('oversize');chunks.push(part.value);}
   const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
   let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));}catch{throw fault('invalid_json');}
   return {status,contentType,parseKind:'json',metadata:catalogSourceShape(value)};
  })();
  try{return [name,{...await Promise.race([action,timed]),elapsedMs:Date.now()-started}];}
  catch(error){return [name,{status:null,contentType:null,parseKind:['oversize','invalid_json','timed_out'].includes(error?.kind)?error.kind:'unavailable',metadata:null,elapsedMs:Date.now()-started}];}
  finally{clearTimeout(timer);controller.abort();if(reader)void reader.cancel().catch(()=>{});}
 }));
 const endpoints=Object.fromEntries(results),l=endpoints.locations,v=endpoints.vacations;
 const contractValid=l.status===200&&v.status===200&&l.metadata?.expectedArrays.cities===true&&l.metadata.expectedArrays.areas===true&&v.metadata?.expectedArrays.places===true&&v.metadata.active.strictTrue>0&&v.metadata.activeSiteID.invalidPositive===0&&v.metadata.activeSiteID.duplicates===0;
 return {operation:'vii-vacation-source-shape-20261018-v1',observedAt,endpoints,contractValid:!!contractValid};
}

const privateHeaders={'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff',vary:'Cookie'};
const reply=(status,data={ok:false},extra={})=>Response.json(data,{status,headers:{...privateHeaders,...extra}});
export function createCatalogSourceAdminHandler({authorize,getApiKey,probe=fetchCatalogSourcePreflight,now=Date.now}){
 let cached,inflight;
 return async function handle(request){
  try{if(await authorize(request)!==true)return reply(403);}catch{return reply(403);}
  const url=new URL(request.url),origin=request.headers.get('origin');
  if(url.pathname!=='/api/admin/catalog-source-preflight')return reply(404);
  if(origin&&origin!==url.origin)return reply(403);
  if(url.search)return reply(400);
  if(request.method!=='GET')return reply(405,{ok:false},{allow:'GET'});
  const time=now();if(!Number.isFinite(time))return reply(503);
  if(cached&&cached.until>time)return reply(200,{ok:true,...cached.value,cached:true});
  try{
   if(!inflight)inflight=(async()=>{
    const apiKey=await getApiKey();
    if(typeof apiKey!=='string'||!apiKey||apiKey.length>2048||!/^[\x21-\x7e]+$/.test(apiKey))throw Error('configuration_unavailable');
    const value=await probe({apiKey});cached={until:now()+300000,value};return value;
   })().finally(()=>{inflight=undefined;});
   return reply(200,{ok:true,...await inflight,cached:false});
  }catch{return reply(503);}
 };
}
