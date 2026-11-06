import type {PublicCacheBucket} from './global-public-cache.ts';

const MAX_BYTES=4*1024*1024,MAX_META=4096,MAX_RETENTION=14*86400000;
const DIGEST=/^[a-f0-9]{64}$/,SOURCE=/^[a-f0-9]{40}$/,BUILD=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const encoder=new TextEncoder();
const mime:Record<string,string>={js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',avif:'image/avif',svg:'image/svg+xml',ico:'image/x-icon'};
function extension(path:string){return /^\/assets\/[a-zA-Z0-9_.-]+-[a-zA-Z0-9_-]{8,}\.(js|css|woff2?|ttf|png|jpe?g|webp|avif|svg|ico)$/.exec(path)?.[1];}
async function digest(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function retainedAssetKey(path:string){if(!extension(path))throw Error('retained_asset_path_invalid');return 'retained-assets-v1/'+await digest(encoder.encode(path));}
export function retainedAssetRequest(request:Request){
 const url=new URL(request.url);
 return url.hostname==='vii.spaplus.co'&&['GET','HEAD'].includes(request.method)&&!url.search&&!request.headers.has('Authorization')&&!request.headers.has('Range')&&!request.headers.has('Next-Action')&&!request.headers.has('X-Server-Action')&&Boolean(extension(url.pathname));
}
type AssetIdentity={path:string;source:string;buildId:string;createdAt:number;retainUntil:number};
function identityValid(identity:AssetIdentity,now:number){return Boolean(extension(identity.path))&&SOURCE.test(identity.source)&&BUILD.test(identity.buildId)&&Number.isSafeInteger(identity.createdAt)&&Number.isSafeInteger(identity.retainUntil)&&identity.createdAt<=now+60000&&identity.retainUntil>now&&identity.retainUntil>identity.createdAt&&identity.retainUntil-identity.createdAt<=MAX_RETENTION;}
/** Packaging primitive only. The release capture must prove full old-asset
 * inventory and compare existing keys before any private R2 write. */
export async function encodeRetainedAsset(identity:AssetIdentity,body:Uint8Array,now=Date.now()){
 if(!identityValid(identity,now)||body.byteLength<1||body.byteLength>MAX_BYTES)throw Error('retained_asset_identity_invalid');
 const metadata=encoder.encode(JSON.stringify({schemaVersion:1,...identity,bytes:body.byteLength,sha256:await digest(body)}));
 if(metadata.byteLength>MAX_META)throw Error('retained_asset_metadata_too_large');
 const result=new Uint8Array(4+metadata.length+body.length);new DataView(result.buffer).setUint32(0,metadata.length);result.set(metadata,4);result.set(body,4+metadata.length);return result;
}
/** Only called after origin404/410. New assets retain the normal fast path.
 * Never rebuild a missing asset or substitute a similar current filename. */
export async function readRetainedAsset(request:Request,bucket:PublicCacheBucket|undefined,{timeoutMs=1500,now=Date.now()}={}){
 if(!bucket||!retainedAssetRequest(request)||request.signal.aborted)return undefined;
 let expired=false,cancel:(()=>Promise<unknown>)|undefined,timer:ReturnType<typeof setTimeout>|undefined,resolveAbort:((value:undefined)=>void)|undefined;
 const abort=()=>{expired=true;void cancel?.().catch(()=>undefined);resolveAbort?.(undefined);};
 request.signal.addEventListener('abort',abort,{once:true});
 const work=(async()=>{
  const path=new URL(request.url).pathname,object=await bucket.get(await retainedAssetKey(path));
  if(!object)return undefined;
  if(expired||!Number.isSafeInteger(object.size)||object.size<5||object.size>MAX_BYTES+MAX_META+4){void object.body.cancel().catch(()=>undefined);return undefined;}
  const reader=object.body.getReader();cancel=()=>reader.cancel();const parts:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(expired||size>object.size||size>MAX_BYTES+MAX_META+4){void reader.cancel().catch(()=>undefined);return undefined;}parts.push(part.value);}}
  finally{reader.releaseLock();}
  if(expired||size!==object.size)return undefined;
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  const length=new DataView(bytes.buffer).getUint32(0);if(length<1||length>MAX_META||4+length>=size)return undefined;
  const metadata=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(4,4+length)));
  const body=bytes.subarray(4+length);
  if(metadata.schemaVersion!==1||metadata.path!==path||!identityValid(metadata,now)||body.length>MAX_BYTES||metadata.bytes!==body.length||!DIGEST.test(metadata.sha256??'')||await digest(body)!==metadata.sha256||expired)return undefined;
  return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':mime[extension(path)!],'Content-Length':String(body.length),'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','X-VII-Asset-Retention':'verified-fallback','X-VII-Asset-Build':metadata.buildId}});
 })().catch(()=>undefined);
 try{return await Promise.race([work,new Promise<undefined>(resolve=>{timer=setTimeout(()=>{abort();resolve(undefined);},timeoutMs);}),new Promise<undefined>(resolve=>{resolveAbort=resolve;if(request.signal.aborted)abort();})]);}
 finally{if(timer)clearTimeout(timer);request.signal.removeEventListener('abort',abort);}
}
