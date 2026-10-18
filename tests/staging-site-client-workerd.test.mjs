import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

test('actual private Stage client works in workerd and never follows redirects',async()=>{
 const require=createRequire(import.meta.url);
 const wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
 const {Miniflare}=await import(pathToFileURL(wranglerRequire.resolve('miniflare')).href);
 const source=readFileSync(new URL('../infrastructure/http/staging-site-client.mjs',import.meta.url),'utf8');
 let status=200,calls=0;
 const mf=new Miniflare({compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  modules:[{type:'ESModule',path:'entry.mjs',contents:`import {createStagingHealthClient} from './client.mjs';const handle=createStagingHealthClient({authorize:async()=>true,now:()=>Date.parse('2026-10-18T08:00:00Z'),getCredentials:async()=>({environment:'staging',clientId:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.access',clientSecret:'synthetic-not-real',expiresAt:'2026-10-18T20:00:00Z'})});export default {fetch:handle};`},{type:'ESModule',path:'client.mjs',contents:source}],
  outboundService:request=>{
   calls++;
   assert.equal(request.url,'https://vii-staging-site-bridge.djskabi.workers.dev/probe');
   assert.equal(request.headers.get('cf-access-client-secret'),'synthetic-not-real');
   assert.equal(request.headers.get('cookie'),null);
   return status===200?Response.json({ok:true,databaseConnected:true,readOnly:true,markerMatched:true}):new Response(null,{status,headers:{location:'https://must-not-follow.invalid/'}});
  },
 });
 try{
  const url='https://site.test/api/admin/staging-private-health';
  const success=await mf.dispatchFetch(url);
  assert.equal(success.status,200);
  assert.deepEqual(await success.json(),{ok:true,databaseConnected:true,readOnly:true,markerMatched:true});
  assert.equal(calls,1);
  for(const redirect of [301,302,303,307,308]){
   status=redirect;const before=calls;const denied=await mf.dispatchFetch(url);
   assert.equal(denied.status,503);assert.deepEqual(await denied.json(),{ok:false});assert.equal(calls,before+1);
  }
 }finally{await mf.dispose();}
});
