import {publicWarmRoutes,browserRscHashes,regionalWarmPaths} from './public-warm.ts';
import {publicDiscoveryCachePolicy} from '../../../shared/public-discovery-cache.ts';

export type PublicCacheBucket={
 get(key:string):Promise<{body:ReadableStream<Uint8Array>;size:number}|null>;
 put(key:string,body:Uint8Array):Promise<unknown>;
};
const MAX_BODY=2*1024*1024,MAX_META=16*1024;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const paths=new Set<string>(publicWarmRoutes);
const rscContexts=new Set(Object.keys(browserRscHashes));
const routing=['Next-Router-State-Tree','Next-Router-Prefetch','Next-Router-Segment-Prefetch','Next-Url'];

// Canonical public documents keep their complete path/locale/build identity.
// Transactional search parameters and router-state variants remain excluded.
export function globalPublicVariant(request:Request,build:string){
 if(build.startsWith('pending-')||request.method!=='GET'||request.headers.has('Authorization')||request.headers.has('Next-Action')||request.headers.has('X-Server-Action'))return false;
 const url=new URL(request.url),rsc=url.pathname.endsWith('.rsc');
 if(url.hostname==='vii.spaplus.co'&&publicDiscoveryCachePolicy(request))return true;
 const path=rsc?url.pathname.slice(0,-4)||'/':url.pathname;
 const base=path.replace(/^\/(?:en|fr|ru)(?=\/|$)/,'')||'/';
 const canonical=paths.has(base)||/^\/(?:last-minute|weekend|vacations|villas|zimmers|suites|luxury-suites|suite-complexes|vacation-apartments|hospitality-complexes|events|spas|hourly|holidays|destinations|providers|trails|attractions|activities|guides|questions|corporate|gift-card|contact|accessibility|legal|discover\/place)(?:\/[a-z0-9-]+)*$/.test(base);
 if(url.hostname!=='vii.spaplus.co'||!canonical&&base!=='/business')return false;
 if(routing.some(name=>request.headers.has(name))||request.headers.has('X-Vinext-Mounted-Slots')||request.headers.has('X-Vinext-Rsc-Render-Mode'))return false;
 const params=new URLSearchParams(url.search);
 if(rsc){const context=request.headers.get('X-Vinext-Interception-Context');if(request.headers.get('Accept')!=='text/x-component'||request.headers.get('RSC')!=='1'||!context||!rscContexts.has(context)||params.getAll('_rsc').length!==1||params.get('_rsc')!==browserRscHashes[context])return false;params.delete('_rsc');}
 else if(request.headers.has('RSC')||!(request.headers.get('Accept')||'').includes('text/html'))return false;
 if(base==='/business')return [...params].length===1&&/^(?:vacation|event)-[1-9]\d{0,8}$/.test(params.get('id')||'');
 // Keep the complete cache key. This admits the explicit default party only
 // on the fixed region family; dates, duplicate fields and other guests never
 // become the same document or gain broader global-cache eligibility.
 return params.size===0 || regionalWarmPaths.includes(base)&&params.size===1&&params.getAll('guests').length===1&&params.get('guests')==='2';
}

async function keyFor(key:Request,build:string){
 const bytes=await crypto.subtle.digest('SHA-256',encoder.encode(key.url));
 const hash=[...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
 return `public-v1/${build}/${hash}`;
}
async function bounded<T>(operation:Promise<T>,ms:number){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([operation,new Promise<undefined>(resolve=>{timer=setTimeout(()=>resolve(undefined),ms);})]);}
 catch{return undefined;}finally{if(timer)clearTimeout(timer);}
}
async function bodyBytes(stream:ReadableStream<Uint8Array>,limit:number,onCancel:(cancel:()=>Promise<void>)=>void){
 const reader=stream.getReader(),parts:Uint8Array[]=[];let size=0;
 onCancel(()=>reader.cancel());
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();return null;}parts.push(part.value);}}
 finally{reader.releaseLock();}
 const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.byteLength;}return out;
}

export async function readGlobalPublicCache(bucket:PublicCacheBucket|undefined,key:Request,build:string){
 if(!bucket)return undefined;
 const start=Date.now();let expired=false,cancel:(()=>Promise<void>)|undefined;
 const work=(async()=>{
  const object=await bucket.get(await keyFor(key,build));
  if(!object)return undefined;
  if(expired||!Number.isSafeInteger(object.size)||object.size<4||object.size>MAX_BODY+MAX_META+4){await object.body.cancel().catch(()=>undefined);return undefined;}
  const bytes=await bodyBytes(object.body,MAX_BODY+MAX_META+4,value=>{cancel=value;});if(expired||!bytes||bytes.byteLength<4)return undefined;
  const length=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0);
  if(!length||length>MAX_META||length+4>=bytes.byteLength||bytes.byteLength-length-4>MAX_BODY)return undefined;
  let value;try{value=JSON.parse(decoder.decode(bytes.subarray(4,4+length)));}catch{return undefined;}
  if(value?.version!==1||value.key!==key.url||value.build!==build||value.status!==200||!Array.isArray(value.headers))return undefined;
  const headers=new Headers(value.headers),until=Number(headers.get('X-VII-Cache-Until'));
  if(headers.has('Set-Cookie')||headers.get('X-VII-Cache-Build')!==build||!Number.isFinite(until)||until<=Date.now()||until>Date.now()+300_000||/(?:private|no-store|no-cache)/i.test(headers.get('Cache-Control')||''))return undefined;
  const expected=decodeURIComponent(new URL(key.url).pathname).includes('/api/')?'application/json':key.url.includes('.rsc')?'text/x-component':'text/html';
  if(!(headers.get('Content-Type')||'').includes(expected))return undefined;
  return new Response(bytes.subarray(4+length),{status:200,headers});
 })();
 const result=await bounded(work,400);expired=true;if(!result&&cancel)void cancel().catch(()=>undefined);
 // A late read is consumed but cannot serve or write after its deadline.
 return Date.now()-start<=450?result:undefined;
}

export async function writeGlobalPublicCache(bucket:PublicCacheBucket|undefined,key:Request,build:string,body:Uint8Array,headers:Headers){
 if(!bucket||!body.byteLength||body.byteLength>MAX_BODY)return;
 const until=Number(headers.get('X-VII-Cache-Until'));
 if(!Number.isFinite(until)||until<=Date.now()||until>Date.now()+900_000||headers.has('Set-Cookie')||headers.get('X-VII-Cache-Build')!==build||/(?:private|no-store|no-cache)/i.test(headers.get('Cache-Control')||''))return;
 headers=new Headers(headers);
 const boundedExpiry=Math.min(until,Date.now()+300_000);
 headers.set('X-VII-Cache-Until',String(boundedExpiry));
 headers.set('Cache-Control',`public,max-age=${Math.max(0,Math.floor((boundedExpiry-Date.now())/1000))}`);
 const meta=encoder.encode(JSON.stringify({version:1,key:key.url,build,status:200,headers:[...headers]}));
 if(meta.byteLength>MAX_META)return;
 const value=new Uint8Array(4+meta.byteLength+body.byteLength);new DataView(value.buffer).setUint32(0,meta.byteLength);value.set(meta,4);value.set(body,4+meta.byteLength);
 await bounded(bucket.put(await keyFor(key,build),value),1500);
}
