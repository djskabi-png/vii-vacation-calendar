const HEADERS={'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff'};
const reply=(status,ok=false,extra={})=>Response.json(ok?{ok:true,databaseConnected:true,readOnly:true,markerMatched:true}:{ok:false},{status,headers:{...HEADERS,...extra}});
export const HEALTH_SQL="SELECT current_database() AS database, current_user AS role, current_setting('transaction_read_only') AS read_only, marker FROM vii_stage_probe.health WHERE id = 1";

export function createBridgeHandler({Client,verifyJwt,now=Date.now}) {
 return async function fetch(request,env) {
  const url=new URL(request.url);
  if(url.pathname!=='/probe'||url.search)return reply(404);
  if(request.method!=='GET')return reply(405,false,{allow:'GET'});
  const time=now(),expires=Date.parse(env.VII_BRIDGE_EXPIRES_AT??''),issued=Date.parse(env.VII_BRIDGE_ISSUED_AT??'');
  if(env.VII_ENVIRONMENT!=='staging'||!Number.isFinite(time)||!Number.isFinite(expires)||!Number.isFinite(issued)||issued>time||expires<=time||expires-issued>86400000||expires<=issued
   ||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.VII_ACCESS_ISSUER??'')
   ||!/^[a-f0-9]{64}$/.test(env.VII_ACCESS_AUD??'')||!/^[a-f0-9]{32}\.access$/.test(env.VII_ACCESS_CLIENT_ID??''))return reply(503);
  const token=request.headers.get('cf-access-jwt-assertion');
  if(!token||token.length>16384)return reply(403);
  try {
   // Cryptographic validation is required. Raw service headers or cookies are insufficient.
   const {payload,protectedHeader}=await verifyJwt(token,{issuer:env.VII_ACCESS_ISSUER,audience:env.VII_ACCESS_AUD,currentDate:new Date(time)});
   if(protectedHeader.alg!=='RS256'||payload.type!=='app'||payload.sub!==''||payload.common_name!==env.VII_ACCESS_CLIENT_ID
    ||!Number.isFinite(payload.iat)||!Number.isFinite(payload.exp)||payload.iat>time/1000+5||payload.exp<=time/1000||payload.iat<issued/1000-60) return reply(403);
  } catch {return reply(403);}
  if(!env.HYPERDRIVE?.connectionString)return reply(503);
  let client;
  try {
   client=new Client({connectionString:env.HYPERDRIVE.connectionString,connectionTimeoutMillis:3000,query_timeout:3000,application_name:'vii-staging-site-health'});
   await client.connect();
   await client.query('BEGIN READ ONLY');
   await client.query("SET LOCAL statement_timeout = '2s'");
   await client.query("SET LOCAL lock_timeout = '1s'");
   const result=await client.query(HEALTH_SQL),row=result.rows?.[0];
   if(result.rows?.length!==1||row.database!=='vii'||row.role!=='vii_stage_probe'||row.read_only!=='on'||row.marker!=='vii-stage-20261018')throw Error('invariant');
   await client.query('ROLLBACK');
   return reply(200,true);
  }catch{return reply(503);}
  finally{if(client)void client.end().catch(()=>{});}
 };
}
