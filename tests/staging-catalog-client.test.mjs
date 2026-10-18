import test from 'node:test';
import assert from 'node:assert/strict';
import {createStagingCatalogClient,readStagingCatalogConfiguration,STAGE_CATALOG_URL,STAGE_CATALOG_ADMIN_PATH} from '../infrastructure/http/staging-catalog-client.mjs';
import {CATALOG_SHADOW_EXPECTED} from '../infrastructure/postgres/catalog-shadow-expected.mjs';
const time=Date.parse('2026-10-18T13:00:00Z');
const credentials=()=>({environment:'staging',issuedAt:new Date(time-1000).toISOString(),expiresAt:new Date(time+86399000).toISOString(),clientId:'a'.repeat(32)+'.access',clientSecret:'SYNTHETIC_ONLY'});
const manifest=()=>({database:'vii',role:'vii_stage_catalog_reader',readOnly:true,worlds:structuredClone(CATALOG_SHADOW_EXPECTED)});
const source=()=>CATALOG_SHADOW_EXPECTED.map(({world,activeRunId,activeCount})=>({world,activeRunId,activeCount,lockRunId:null,lockUntil:null}));
function setup(options={}){
 const {config=credentials(),data={ok:true,manifest:manifest()},upstream,sourceRows=source(),deadlineMs=1000}=options;
 const authorized=Object.hasOwn(options,'authorized')?options.authorized:true;
 let fetches=0,sources=0,configs=0;const diagnostics=[],requests=[];
 const handle=createStagingCatalogClient({authorize:async()=>authorized,getCredentials:async()=>{configs++;return config;},
  getCurrentGenerations:async()=>{sources++;return sourceRows;},expectedWorlds:CATALOG_SHADOW_EXPECTED,now:()=>time,deadlineMs,
  diagnostics:code=>diagnostics.push(code),fetchImpl:async(url,options)=>{fetches++;requests.push({url,options});return upstream?upstream():Response.json(data);}});
 return{run:(path=STAGE_CATALOG_ADMIN_PATH,method='GET',headers={})=>handle(new Request('https://unit.test'+path,{method,headers})),
  stats:()=>({fetches,sources,configs,requests,diagnostics})};
}
test('server secret selector prefers exactworker value and onlyfallsbackto process',()=>{
 assert.deepEqual(readStagingCatalogConfiguration('{"chosen":1}','{"chosen":2}'),{chosen:1});
 assert.deepEqual(readStagingCatalogConfiguration(undefined,'{"chosen":2}'),{chosen:2});
 for(const value of ['',null,'invalid','a'.repeat(2049)])assert.throws(()=>readStagingCatalogConfiguration(value,undefined),/private_catalog/);
});
test('actual frozen fourworldmetadata comparison is bounded and never forwards request identity',async()=>{
 const s=setup(),r=await s.run(undefined,'GET',{cookie:'PRIVATE_COOKIE',authorization:'PRIVATE_AUTH','cf-access-authenticated-user-email':'forged'});
 assert.equal(r.status,200);const result=await r.json();assert.equal(result.projectedCatalogMatched,true);
 assert.equal(result.worlds.reduce((n,x)=>n+x.entries,0),893);assert.equal(result.publicSourceChanged,false);
 assert.equal(result.fullLaunchReady,false);assert.doesNotMatch(JSON.stringify(result),/sha256|SYNTHETIC_ONLY|PRIVATE/);
 const sent=s.stats().requests[0];assert.equal(sent.url,STAGE_CATALOG_URL);assert.equal(sent.options.redirect,'manual');
 assert.equal(sent.options.credentials,'omit');assert.equal(sent.options.headers.cookie,undefined);assert.equal(sent.options.headers.authorization,undefined);
 assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('vary'),/Cookie/);
});
test('literal existingadmin authorization is mandatory before credentials/network/source',async()=>{
 for(const authorized of[false,undefined,1,{}]){
  const s=setup({authorized}),r=await s.run();assert.equal(r.status,403);
  assert.equal(s.stats().configs+s.stats().fetches+s.stats().sources,0);
 }
});
test('wrongpath, query, cross-origin and writes denied before configuration',async()=>{
 for(const[path,method,headers,status]of[['/other','GET',{},404],[STAGE_CATALOG_ADMIN_PATH+'?sql=x','GET',{},400],
  [STAGE_CATALOG_ADMIN_PATH,'GET',{origin:'https://other.test'},403],[STAGE_CATALOG_ADMIN_PATH,'POST',{},405]]){
  const s=setup();assert.equal((await s.run(path,method,headers)).status,status);assert.equal(s.stats().configs,0);
 }
});
test('configuration missing, future, expired, over24h or extra fields never sends secret',async()=>{
 for(const change of[{environment:'production'},{issuedAt:new Date(time+1).toISOString()},{expiresAt:new Date(time).toISOString()},
  {expiresAt:new Date(time+86400000).toISOString()},{clientId:'bad'},{clientSecret:'bad\nvalue'},{extra:true}]){
  const s=setup({config:{...credentials(),...change}});assert.equal((await s.run()).status,503);assert.equal(s.stats().fetches,0);
 }
});
test('redirects and upstream denials neverfollow or leak payload',async()=>{
 for(const status of[301,302,303,307,308,401,403,500]){
  const s=setup({upstream:()=>new Response('PRIVATE_UPSTREAM',{status,headers:{location:'https://other.test/'}})}),r=await s.run();
  assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false});assert.equal(s.stats().fetches,1);assert.equal(s.stats().sources,0);
 }
});
test('type, size, decoding and malformed metadata fail closed',async()=>{
 for(const upstream of[()=>new Response('{}',{headers:{'content-type':'text/html'}}),
  ()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'8193'}}),
  ()=>new Response('a'.repeat(8193),{headers:{'content-type':'application/json'}}),
  ()=>new Response(Uint8Array.from([0xff]),{headers:{'content-type':'application/json'}}),
  ()=>Response.json({ok:true,manifest:manifest(),extra:true}),()=>Response.json({ok:true,manifest:{...manifest(),role:'vii_owner'}})]){
  const s=setup({upstream}),r=await s.run();assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false});
 }
});
test('stale sourcegeneration or changed Stagehash cannot be reported as parity',async()=>{
 const rows=source();rows[0].activeRunId='new-generation';const stale=setup({sourceRows:rows});
 assert.equal((await stale.run()).status,503);assert.deepEqual(stale.stats().diagnostics,['stale_source_generation']);
 const value=manifest();value.worlds[0].sha256='f'.repeat(64);const tampered=setup({data:{ok:true,manifest:value}});
 assert.equal((await tampered.run()).status,503);assert.deepEqual(tampered.stats().diagnostics,['shadow_parity_mismatch']);
});
test('stalledstream is bounded by timeout and raw networkerrors neverescape',async()=>{
 const stalled=setup({deadlineMs:10,upstream:()=>new Response(new ReadableStream({start(){}}),{headers:{'content-type':'application/json'}})});
 assert.equal((await stalled.run()).status,503);assert.deepEqual(stalled.stats().diagnostics,['upstream_timeout']);
 const broken=setup({upstream:()=>{throw Error('PRIVATE_PASSWORD_VALUE');}}),r=await broken.run();
 assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false});assert.doesNotMatch(JSON.stringify(broken.stats().diagnostics),/PRIVATE/);
});
