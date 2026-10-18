// Private synthetic Stage health only, under the exact24h service approval.
// Never use for public reads, customer records or production database traffic.
export const STAGE_HEALTH_URL='https://vii-staging-site-bridge.djskabi.workers.dev/probe';
export const STAGE_HEALTH_ADMIN_PATH='/api/admin/staging-private-health';
const KEYS=['databaseConnected','markerMatched','ok','readOnly'];
const MAX_BYTES=512;
const reply=(status,ok=false,extra={})=>Response.json(ok
 ? {ok:true,databaseConnected:true,readOnly:true,markerMatched:true}
 : {ok:false},{status,headers:{'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff',...extra}});

export function createStagingHealthClient({authorize,getCredentials,fetchImpl=fetch,now=Date.now,deadlineMs=8000}) {
 if(typeof authorize!=='function'||typeof getCredentials!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||!Number.isInteger(deadlineMs)||deadlineMs<1||deadlineMs>8000)throw Error('invalid_private_health_dependencies');
 return async function handle(request) {
  // An authenticated session alone is insufficient: caller must resolve the
  // existing administrator allowlist and return the boolean true explicitly.
  try {if(await authorize(request)!==true)return reply(403);} catch {return reply(403);}
  const url=new URL(request.url);
  if(url.pathname!==STAGE_HEALTH_ADMIN_PATH)return reply(404);
  if(url.search)return reply(400);
  if(request.method!=='GET')return reply(405,false,{allow:'GET'});
  let credentials;
  try {
   credentials=await getCredentials();
   if(typeof credentials?.expiresAt!=='string')return reply(503);
   const expires=Date.parse(credentials.expiresAt),time=now();
   if(credentials.environment!=='staging'||!Number.isFinite(time)||!Number.isFinite(expires)||expires<=time||expires>time+24*60*60*1000
    ||typeof credentials.clientId!=='string'||!/^[a-f0-9]{32}\.access$/.test(credentials.clientId)
    ||typeof credentials.clientSecret!=='string'||!/^[\x21-\x7e]{1,512}$/.test(credentials.clientSecret))return reply(503);
  } catch {return reply(503);}
  const controller=new AbortController();
  let timer,reader;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('private_health_timeout'));},deadlineMs);});
  try {
   const action=(async()=>{
    // Never forward request headers, cookies, body, query or a caller URL.
    const upstream=await fetchImpl(STAGE_HEALTH_URL,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal,
     headers:{accept:'application/json','CF-Access-Client-Id':credentials.clientId,'CF-Access-Client-Secret':credentials.clientSecret}});
    if(upstream.status!==200||!/^application\/json(?:\s*;|$)/i.test(upstream.headers.get('content-type')??''))throw Error('private_health_unavailable');
    const declared=upstream.headers.get('content-length');
    if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BYTES))throw Error('private_health_size');
    if(!upstream.body)throw Error('private_health_empty');
    reader=upstream.body.getReader();
    const chunks=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>MAX_BYTES)throw Error('private_health_size');chunks.push(part.value);}
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(!data||typeof data!=='object'||Array.isArray(data)||JSON.stringify(Object.keys(data).sort())!==JSON.stringify(KEYS)||!KEYS.every(key=>data[key]===true))throw Error('private_health_shape');
    return reply(200,true);
   })();
   return await Promise.race([action,timeout]);
  } catch {return reply(503);}
  finally {
   clearTimeout(timer);controller.abort();
   // Cleanup must not prolong the bounded response if an upstream stream stalls.
   if(reader)void reader.cancel().catch(()=>{});
  }
 };
}
