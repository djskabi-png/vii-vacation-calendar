import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite/package.json')]}));
const {Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
import {encodeRetainedAsset,retainedAssetKey} from '../services/vii-edge-delivery/src/retained-assets.ts';

test('actual bundled Edge and real local R2 recover exact old JS only after origin404',async()=>{
 const bundle=await build({entryPoints:['services/vii-edge-delivery/src/index.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:*']});
 let status=404,calls=0;
 // Match the installed local workerd ceiling, as in the other runtime tests.
 // This is not evidence for newer production compatibility-date behavior.
 const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-22',r2Buckets:['PUBLIC_CACHE'],outboundService:()=>{calls++;return new Response(status===200?'current':'missing',{status});}});
 try{
  const path='/assets/prior-world-Abcd1234.js',now=Date.now(),body=new TextEncoder().encode('export const previous=1;');
  const encoded=await encodeRetainedAsset({path,source:'a'.repeat(40),buildId:'11111111-2222-3333-4444-555555555555',createdAt:now,retainUntil:now+86400000},body,now);
  const bucket=await mf.getR2Bucket('PUBLIC_CACHE');await bucket.put(await retainedAssetKey(path),encoded);
  const recovered=await mf.dispatchFetch('https://vii.spaplus.co'+path);assert.equal(recovered.status,200);assert.equal(await recovered.text(),new TextDecoder().decode(body));assert.equal(recovered.headers.get('X-VII-Asset-Retention'),'verified-fallback');
  status=200;const current=await mf.dispatchFetch('https://vii.spaplus.co'+path);assert.equal(await current.text(),'current');assert.equal(current.headers.get('X-VII-Asset-Retention'),null);
  status=404;const missing=await mf.dispatchFetch('https://vii.spaplus.co/assets/unknown-Abcd1234.js');assert.equal(missing.status,404);assert.equal(calls,3);
  // Measured predecessor size, including exact zero-byte generated modules.
  for(const size of [0,6864710]){
   const path='/assets/retained-size'+size+'-Abcd1234.js',body=new Uint8Array(size);if(size){body[0]=47;body[size-1]=59;}
   const bytes=await encodeRetainedAsset({path,source:'a'.repeat(40),buildId:'11111111-2222-3333-4444-555555555555',createdAt:now,retainUntil:now+86400000},body,now);
   await bucket.put(await retainedAssetKey(path),bytes);const response=await mf.dispatchFetch('https://vii.spaplus.co'+path);
   assert.equal(response.status,200);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),body);
  }
 }finally{await mf.dispose();}
});
