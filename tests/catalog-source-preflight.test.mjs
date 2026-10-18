import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {catalogSourceShape,fetchCatalogSourcePreflight,createCatalogSourceAdminHandler} from '../infrastructure/http/catalog-source-preflight.mjs';
const locations={cities:[{}],areas:[{}]},list={places:[{active:true,siteID:4},{active:false,siteID:'invalid-inactive'}]};
const mock=(a=locations,b=list)=>async url=>Response.json(url.endsWith('/locations')?a:b);
test('fixed two requests, metadata only and active-only guards match parser',async()=>{
 const calls=[];const r=await fetchCatalogSourcePreflight({apiKey:'SYNTHETIC_TOKEN',now:()=>0,fetchImpl:async(url,options)=>{calls.push({url,options});return mock()(url);}});
 assert.equal(r.contractValid,true);assert.equal(r.endpoints.vacations.metadata.activeSiteID.invalidPositive,0);
 assert.deepEqual(calls.map(x=>x.url),['https://bizonline.co.il/api/ai/vii/locations','https://bizonline.co.il/api/ai/vii/vacations']);
 for(const {options:o}of calls){assert.equal(o.redirect,'manual');assert.equal(o.credentials,'omit');assert.equal(o.method,'GET');assert.equal(o.headers.Authorization,'Bearer SYNTHETIC_TOKEN');assert.equal(o.headers.Cookie,undefined);}
 assert.doesNotMatch(JSON.stringify(r),/SYNTHETIC|invalid-inactive|https:/);
});
test('wrapper/type/empty/missing/invalid/duplicate variants report counts without adapting contract',async()=>{
 const r=await fetchCatalogSourcePreflight({apiKey:'x',fetchImpl:mock({data:locations,UNEXPECTED_PRIVATE_KEY:'PRIVATE'},list)});
 assert.equal(r.contractValid,false);assert.equal(r.endpoints.locations.metadata.wrappedDataArrays.cities,true);assert.equal(r.endpoints.locations.metadata.unknownKeyCount,1);assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
 for(const places of[[],[{active:1,siteID:3}],[{active:'true',siteID:3}],[{active:true}],[{active:true,siteID:'3'}],[{active:true,siteID:0}],[{active:true,siteID:3},{active:true,siteID:3}]]){
  assert.equal((await fetchCatalogSourcePreflight({apiKey:'x',fetchImpl:mock(locations,{places})})).contractValid,false);
 }
 assert.equal(catalogSourceShape({places:[{active:true,siteID:2},{active:false,siteID:2}]}).activeSiteID.duplicates,0);
});
test('redirects and upstream HTTP failures neverfollow or echo body/header values',async()=>{
 for(const status of[301,302,303,307,308,401,403,500]){let calls=0;
  const r=await fetchCatalogSourcePreflight({apiKey:'x',fetchImpl:async()=>{calls++;return new Response('PRIVATE_BODY',{status,headers:{location:'https://PRIVATE','content-type':'PRIVATE_HEADER'}});}});
  assert.equal(calls,2);assert.equal(r.contractValid,false);assert.equal(r.endpoints.locations.status,status);assert.equal(r.endpoints.locations.contentType,'other');assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
 }
});
test('malformed UTF8/JSON and header/stream oversize are bounded and sanitized',async()=>{
 for(const [response,kind]of[[()=>new Response('{bad'),'invalid_json'],[()=>new Response(Uint8Array.from([255])),'invalid_json'],[()=>new Response('{}',{headers:{'content-length':'2097153'}}),'oversize'],[()=>new Response('x'.repeat(2097153)),'oversize']]){
  const r=await fetchCatalogSourcePreflight({apiKey:'x',fetchImpl:async()=>response()});assert.equal(r.endpoints.locations.parseKind,kind);assert.equal(r.contractValid,false);
 }
});
test('stalled fetch/body time out even when mock ignores abort, raw failures neverescape',async()=>{
 for(const fetchImpl of[()=>new Promise(()=>{}),async()=>new Response(new ReadableStream({start(){}}))]){
  const r=await fetchCatalogSourcePreflight({apiKey:'x',fetchImpl,deadlineMs:10});assert.equal(r.endpoints.locations.parseKind,'timed_out');assert.equal(r.endpoints.vacations.parseKind,'timed_out');
 }
 assert.doesNotMatch(JSON.stringify(await fetchCatalogSourcePreflight({apiKey:'x',fetchImpl:async()=>{throw Error('PRIVATE_SECRET');}})),/PRIVATE_SECRET/);
});
test('unsafe configuration rejected before network',async()=>{
 for(const apiKey of['','a\nb','a b','x'.repeat(2049)])await assert.rejects(fetchCatalogSourcePreflight({apiKey}),/configuration/);
 for(const deadlineMs of[0,8001,1.5])await assert.rejects(fetchCatalogSourcePreflight({apiKey:'x',deadlineMs}),/configuration/);
});
const path='/api/admin/catalog-source-preflight';
test('admin auth and fixed path/method/origin/query rejected before secret or probe',async()=>{
 for(const [authorized,url,method,headers,status]of[[false,path,'GET',{},403],[1,path,'GET',{},403],[true,'/other','GET',{},404],
  [true,path+'?world=events','GET',{},400],[true,path,'POST',{},405],[true,path,'GET',{origin:'https://other.test'},403]]){
  let calls=0;const handler=createCatalogSourceAdminHandler({authorize:async()=>authorized,getApiKey:async()=>{calls++;return 'x';},probe:async()=>{calls++;return {};}});
  const r=await handler(new Request('https://site.test'+url,{method,headers}));assert.equal(r.status,status);assert.equal(calls,0);
 }
});
test('admin probe coalesces concurrent calls and caches only metadata for5min',async()=>{
 let count=0,clock=0,resolve;
 const handler=createCatalogSourceAdminHandler({authorize:async()=>true,getApiKey:async()=>'SYNTHETIC_ONLY',now:()=>clock,
  probe:async options=>{assert.deepEqual(Object.keys(options),['apiKey']);count++;if(count===1)await new Promise(r=>{resolve=r;});return {contractValid:false,observedAt:'fixed'};}});
 const request=()=>new Request('https://site.test'+path,{headers:{cookie:'DO_NOT_FORWARD'}});
 const a=handler(request()),b=handler(request());await new Promise(r=>setTimeout(r,0));assert.equal(count,1);resolve();
 const [ra,rb]=await Promise.all([a,b]);assert.equal(ra.status,200);assert.equal(rb.status,200);await ra.json();await rb.json();
 const cached=await handler(request());assert.equal((await cached.json()).cached,true);assert.equal(count,1);
 assert.match(cached.headers.get('cache-control'),/private, no-store/);assert.match(cached.headers.get('x-robots-tag'),/noindex/);
 clock=300001;const fresh=await handler(request());assert.equal((await fresh.json()).cached,false);assert.equal(count,2);
});
test('missing credentials and raw probe errors return generic denial',async()=>{
 for(const key of[undefined,'','bad\nvalue']){let calls=0;const handler=createCatalogSourceAdminHandler({authorize:async()=>true,getApiKey:async()=>key,probe:async()=>{calls++;}});
  const r=await handler(new Request('https://site.test'+path));assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false});assert.equal(calls,0);}
 const bad=createCatalogSourceAdminHandler({authorize:async()=>true,getApiKey:async()=>'x',probe:async()=>{throw Error('PRIVATE_SECRET');}});
 const r=await bad(new Request('https://site.test'+path));assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false});
});
test('actual module works in pinned workerd using only two fixed upstream calls',async()=>{
 const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json'));
 const {Miniflare}=await import(pathToFileURL(wr.resolve('miniflare')).href);
 let calls=0;
 const mf=new Miniflare({compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  modules:[{type:'ESModule',path:'entry.mjs',contents:`import {createCatalogSourceAdminHandler} from './probe.mjs';export default {fetch:createCatalogSourceAdminHandler({authorize:async()=>true,getApiKey:async()=>'SYNTHETIC_ONLY'})};`},
   {type:'ESModule',path:'probe.mjs',contents:readFileSync(new URL('../infrastructure/http/catalog-source-preflight.mjs',import.meta.url),'utf8')}],
  outboundService:request=>{calls++;assert.equal(request.headers.get('authorization'),'Bearer SYNTHETIC_ONLY');assert.equal(request.headers.get('cookie'),null);
   assert.ok(['https://bizonline.co.il/api/ai/vii/locations','https://bizonline.co.il/api/ai/vii/vacations'].includes(request.url));
   return Response.json(request.url.endsWith('/locations')?locations:list);}});
 try{const r=await mf.dispatchFetch('https://site.test'+path);assert.equal(r.status,200);const body=await r.json();assert.equal(body.contractValid,true);assert.equal(calls,2);
  const again=await mf.dispatchFetch('https://site.test'+path);assert.equal((await again.json()).cached,true);assert.equal(calls,2);
 }finally{await mf.dispose();}
});
