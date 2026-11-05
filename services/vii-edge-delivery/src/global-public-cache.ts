import {publicWarmRoutes} from './public-warm.ts';

export type PublicCacheBucket={
 get(key:string):Promise<{body:ReadableStream<Uint8Array>;size:number}|null>;
 put(key:string,body:Uint8Array):Promise<unknown>;
};
const MAX_BODY=2*1024*1024,MAX_META=16*1024;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const paths=new Set<string>(publicWarmRoutes);
const routing=['Next-Router-State-Tree','Next-Router-Prefetch','Next-Router-Segment-Prefetch','Next-Url','X-Vinext-Interception-Context','X-Vinext-Mounted-Slots','X-Vinext-Rsc-Render-Mode'];

// Initial global tier is deliberately only the sixteen fixed anonymous warm
// variants. Search queries, dates, locale variants and personalized requests
// retain the existing regional/origin path without durable cache writes.
export function globalPublicVariant(request:Request,build:string){
 if(build.startsWith('pending-')||request.method!=='GET'||request.headers.has('Authorization')||request.headers.has('Next-Action')||request.headers.has('X-Server-Action'))return false;
 const url=new URL(request.url),rsc=url.pathname.endsWith('.rsc');
 if(url.hostname!=='vii.spaplus.co'||!paths.has(rsc?url.pathname.slice(0,-4)||'/':url.pathname))return false;
 if(routing.some(name=>request.headers.get(name)))return false;
 if(rsc)return request.headers.get('Accept')==='text/x-component'&&request.headers.get('RSC')==='1'&&[...url.searchParams].length===1&&url.searchParams.get('_rsc')==='';
 return !url.search&&!request.headers.has('RSC')&&(request.headers.get('Accept')||'').includes('text/html');
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
  const expected=key.url.includes('.rsc')?'text/x-component':'text/html';
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
 if(!Number.isFinite(until)||until<=Date.now()||until>Date.now()+300_000||headers.has('Set-Cookie')||headers.get('X-VII-Cache-Build')!==build||/(?:private|no-store|no-cache)/i.test(headers.get('Cache-Control')||''))return;
 const meta=encoder.encode(JSON.stringify({version:1,key:key.url,build,status:200,headers:[...headers]}));
 if(meta.byteLength>MAX_META)return;
 const value=new Uint8Array(4+meta.byteLength+body.byteLength);new DataView(value.buffer).setUint32(0,meta.byteLength);value.set(meta,4);value.set(body,4+meta.byteLength);
 await bounded(bucket.put(await keyFor(key,build),value),1500);
}
