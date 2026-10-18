import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {CATALOG_SHADOW_EXPECTED} from '../infrastructure/postgres/catalog-shadow-expected.mjs';

test('actual catalog client in workerd compares projected snapshot and rejects every redirect',async()=>{
 const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json'));
 const {Miniflare}=await import(pathToFileURL(wr.resolve('miniflare')).href);
 const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 let status=200,calls=0;
 const expected=JSON.stringify(CATALOG_SHADOW_EXPECTED);
 // Pinned local workerd supports dates through 2026-05-22; the deployed date is verified separately.
 const mf=new Miniflare({compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  modules:[{type:'ESModule',path:'entry.mjs',contents:`import {createStagingCatalogClient} from './infrastructure/http/staging-catalog-client.mjs';const expected=${expected};export default {fetch:createStagingCatalogClient({authorize:async()=>true,now:()=>Date.parse('2026-10-18T13:00:00Z'),getCredentials:async()=>({environment:'staging',issuedAt:'2026-10-18T12:00:00Z',expiresAt:'2026-10-19T12:00:00Z',clientId:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.access',clientSecret:'SYNTHETIC_ONLY'}),getCurrentGenerations:async()=>expected.map(({world,activeRunId,activeCount})=>({world,activeRunId,activeCount,lockRunId:null,lockUntil:null})),expectedWorlds:expected})};`},
   ...['infrastructure/http/staging-catalog-client.mjs','infrastructure/postgres/catalog-shadow-manifest.mjs'].map(path=>({type:'ESModule',path,contents:source(path)}))],
  outboundService:request=>{
   calls++;assert.equal(request.url,'https://vii-staging-catalog-shadow.djskabi.workers.dev/catalog-manifest');
   assert.equal(request.headers.get('cf-access-client-secret'),'SYNTHETIC_ONLY');
   assert.equal(request.headers.get('cookie'),null);assert.equal(request.headers.get('authorization'),null);
   return status===200?Response.json({ok:true,manifest:{database:'vii',role:'vii_stage_catalog_reader',readOnly:true,worlds:CATALOG_SHADOW_EXPECTED}}):new Response(null,{status,headers:{location:'https://must-not-follow.invalid/'}});
  }});
 try{
  const url='https://site.test/api/admin/staging-catalog-comparison';
  const success=await mf.dispatchFetch(url,{headers:{cookie:'PRIVATE_COOKIE',authorization:'PRIVATE_AUTH'}});
  assert.equal(success.status,200);const body=await success.json();assert.equal(body.projectedCatalogMatched,true);
  assert.equal(body.worlds.reduce((n,x)=>n+x.entries,0),893);assert.equal(body.publicSourceChanged,false);assert.equal(body.fullLaunchReady,false);
  assert.equal(calls,1);
  for(const redirect of[301,302,303,307,308]){status=redirect;const before=calls;
   const denied=await mf.dispatchFetch(url);assert.equal(denied.status,503);assert.deepEqual(await denied.json(),{ok:false});assert.equal(calls,before+1);}
 }finally{await mf.dispose();}
});
