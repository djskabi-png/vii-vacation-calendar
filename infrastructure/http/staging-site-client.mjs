// Private synthetic Stage health only, under the exact24h service approval.
// Never use for public reads, customer records or production database traffic.
export const STAGE_HEALTH_URL='https://vii-staging-site-bridge.djskabi.workers.dev/probe';
export const STAGE_HEALTH_ADMIN_PATH='/api/admin/staging-private-health';
const KEYS=['databaseConnected','markerMatched','ok','readOnly'];
const MAX_BYTES=512;
const DIAGNOSTICS=new Set(['config_missing','config_size','config_json','config_read_failure','config_environment','config_expiry','config_client_id','config_client_secret','upstream_auth','upstream_http','upstream_type','upstream_size','upstream_empty','upstream_decode','upstream_shape','upstream_timeout','upstream_network']);
const healthError=code=>Object.assign(Error('private_health_unavailable'),{healthCode:code});
// Sites runtime secrets may be exposed through process.env rather than the
// Cloudflare storage-binding facade. Accept only this one server-side value.
export function readStagingHealthConfiguration(workerValue,processValue) {
 const raw=typeof workerValue==='string'&&workerValue.length>0?workerValue:processValue;
 if(typeof raw!=='string'||raw.length===0)throw healthError('config_missing');
 if(raw.length>2048)throw healthError('config_size');
 try{return JSON.parse(raw);}catch{throw healthError('config_json');}
}
const reply=(status,ok=false,extra={})=>Response.json(ok
 ? {ok:true,databaseConnected:true,readOnly:true,markerMatched:true}
 : {ok:false},{status,headers:{'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff',...extra}});

export function createStagingHealthClient({authorize,getCredentials,fetchImpl=fetch,now=Date.now,deadlineMs=8000,diagnostics}) {
 if(typeof authorize!=='function'||typeof getCredentials!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||!Number.isInteger(deadlineMs)||deadlineMs<1||deadlineMs>8000)throw Error('invalid_private_health_dependencies');
 const report=code=>{
  if(!DIAGNOSTICS.has(code)||typeof diagnostics!=='function')return;
  try{const pending=diagnostics(code);if(pending&&typeof pending.catch==='function')pending.catch(()=>{});}catch{/* Diagnostics cannot change request behavior. */}
 };
 const unavailable=code=>{report(code);return reply(503);};
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
   if(typeof credentials?.expiresAt!=='string')return unavailable('config_expiry');
   const expires=Date.parse(credentials.expiresAt),time=now();
   if(credentials.environment!=='staging')return unavailable('config_environment');
   if(!Number.isFinite(time)||!Number.isFinite(expires)||expires<=time||expires>time+24*60*60*1000)return unavailable('config_expiry');
   if(typeof credentials.clientId!=='string'||!/^[a-f0-9]{32}\.access$/.test(credentials.clientId))return unavailable('config_client_id');
   if(typeof credentials.clientSecret!=='string'||!/^[\x21-\x7e]{1,512}$/.test(credentials.clientSecret))return unavailable('config_client_secret');
  } catch(error){return unavailable(DIAGNOSTICS.has(error?.healthCode)&&error.healthCode.startsWith('config_')?error.healthCode:'config_read_failure');}
  const controller=new AbortController();
  let timer,reader;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(healthError('upstream_timeout'));},deadlineMs);});
  try {
   const action=(async()=>{
    // Never forward request headers, cookies, body, query or a caller URL.
    // workerd rejects redirect:error before transport. Manual never follows a
    // redirect; the exact-200 gate below rejects every redirect response.
    const upstream=await fetchImpl(STAGE_HEALTH_URL,{method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',signal:controller.signal,
     headers:{accept:'application/json','CF-Access-Client-Id':credentials.clientId,'CF-Access-Client-Secret':credentials.clientSecret}});
    if(upstream.status===401||upstream.status===403)throw healthError('upstream_auth');
    if(upstream.status!==200)throw healthError('upstream_http');
    if(!/^application\/json(?:\s*;|$)/i.test(upstream.headers.get('content-type')??''))throw healthError('upstream_type');
    const declared=upstream.headers.get('content-length');
    if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BYTES))throw healthError('upstream_size');
    if(!upstream.body)throw healthError('upstream_empty');
    reader=upstream.body.getReader();
    const chunks=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>MAX_BYTES)throw healthError('upstream_size');chunks.push(part.value);}
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    let data;
    try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw healthError('upstream_decode');}
    if(!data||typeof data!=='object'||Array.isArray(data)||JSON.stringify(Object.keys(data).sort())!==JSON.stringify(KEYS)||!KEYS.every(key=>data[key]===true))throw healthError('upstream_shape');
    return reply(200,true);
   })();
   return await Promise.race([action,timeout]);
  } catch(error){return unavailable(DIAGNOSTICS.has(error?.healthCode)&&error.healthCode.startsWith('upstream_')?error.healthCode:'upstream_network');}
  finally {
   clearTimeout(timer);controller.abort();
   // Cleanup must not prolong the bounded response if an upstream stream stalls.
   if(reader)void reader.cancel().catch(()=>{});
  }
 };
}
