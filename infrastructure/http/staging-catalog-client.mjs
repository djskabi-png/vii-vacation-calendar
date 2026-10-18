import {compareShadowManifest} from '../postgres/catalog-shadow-manifest.mjs';
export const STAGE_CATALOG_URL='https://vii-staging-catalog-shadow.djskabi.workers.dev/catalog-manifest';
export const STAGE_CATALOG_ADMIN_PATH='/api/admin/staging-catalog-comparison';
const headers={'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff',vary:'Cookie'};
const reply=(status,body={ok:false},extra={})=>Response.json(body,{status,headers:{...headers,...extra}});
const error=code=>Object.assign(Error('private_catalog_comparison_unavailable'),{catalogCode:code});
const codes=new Set(['config','upstream_http','upstream_type','upstream_size','upstream_decode','upstream_shape','upstream_network','upstream_timeout','source_unavailable','stale_source_generation','shadow_parity_mismatch']);
export function readStagingCatalogConfiguration(workerValue,processValue){
 const raw=typeof workerValue==='string'&&workerValue?workerValue:processValue;
 if(typeof raw!=='string'||!raw||raw.length>2048)throw error('config');
 try{return JSON.parse(raw);}catch{throw error('config');}
}
export function createStagingCatalogClient({authorize,getCredentials,getCurrentGenerations,expectedWorlds,
 fetchImpl=fetch,now=Date.now,deadlineMs=8000,diagnostics}){
 if([authorize,getCredentials,getCurrentGenerations,fetchImpl,now].some(fn=>typeof fn!=='function')||
  !Number.isInteger(deadlineMs)||deadlineMs<1||deadlineMs>8000)throw Error('invalid_catalog_dependencies');
 return async function handle(request){
  try{if(await authorize(request)!==true)return reply(403);}catch{return reply(403);}
  const url=new URL(request.url),origin=request.headers.get('origin');
  if(url.pathname!==STAGE_CATALOG_ADMIN_PATH)return reply(404);
  if(origin&&origin!==url.origin)return reply(403);
  if(url.search)return reply(400);
  if(request.method!=='GET')return reply(405,{ok:false},{allow:'GET'});
  let config;
  try{
   config=await getCredentials();
   if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).length!==5||
    !['environment','issuedAt','expiresAt','clientId','clientSecret'].every(key=>Object.hasOwn(config,key)))throw error('config');
   const time=now(),issued=Date.parse(config.issuedAt),expires=Date.parse(config.expiresAt);
   if(config.environment!=='staging'||!Number.isFinite(time)||!Number.isFinite(issued)||!Number.isFinite(expires)||
    issued>time||expires<=time||expires<=issued||expires-issued>86400000||
    !/^[a-f0-9]{32}\.access$/.test(config.clientId??'')||typeof config.clientSecret!=='string'||
    !/^[\x21-\x7e]{1,512}$/.test(config.clientSecret))throw error('config');
  }catch{return reply(503);}
  const controller=new AbortController();let reader,timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(error('upstream_timeout'));},deadlineMs);});
  try{
   const action=(async()=>{
    const upstream=await fetchImpl(STAGE_CATALOG_URL,{method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',signal:controller.signal,
     headers:{accept:'application/json','CF-Access-Client-Id':config.clientId,'CF-Access-Client-Secret':config.clientSecret}});
    if(upstream.status!==200)throw error('upstream_http');
    if(!/^application\/json(?:\s*;|$)/i.test(upstream.headers.get('content-type')??''))throw error('upstream_type');
    const length=upstream.headers.get('content-length');
    if(length!==null&&(!/^\d+$/.test(length)||Number(length)>8192))throw error('upstream_size');
    if(!upstream.body)throw error('upstream_shape');
    reader=upstream.body.getReader();const chunks=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8192)throw error('upstream_size');chunks.push(part.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw error('upstream_decode');}
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==2||body.ok!==true||!Object.hasOwn(body,'manifest'))throw error('upstream_shape');
    let source;try{source=await getCurrentGenerations();}catch{throw error('source_unavailable');}
    return reply(200,compareShadowManifest(body.manifest,expectedWorlds,source));
   })();
   return await Promise.race([action,timeout]);
  }catch(failure){
   const code=codes.has(failure?.catalogCode)?failure.catalogCode:codes.has(failure?.message)?failure.message:'upstream_shape';
   if(typeof diagnostics==='function')try{diagnostics(code);}catch{/* fixed code only */}
   return reply(503);
  }finally{clearTimeout(timer);controller.abort();if(reader)void reader.cancel().catch(()=>{});}
 };
}
