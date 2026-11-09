import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
const rootRequire = createRequire(import.meta.url);
const requireFromWrangler = createRequire(rootRequire.resolve("wrangler"));
const { Miniflare } = requireFromWrangler("miniflare");
const { buildSync } = requireFromWrangler("esbuild");

test("Workers runtime rejects redirect:error at Request construction", async () => {
  const mf = new Miniflare({ modules: true, script: `export default { async fetch(){ try { new Request('https://www.vii.co.il/gallery/x.jpg',{redirect:'error'}); return new Response('no-error',{status:500}); } catch (error) { return new Response(JSON.stringify({name:error?.name,message:String(error?.message)}),{headers:{'content-type':'application/json'}}); } } }` });
  try {
    const response = await mf.dispatchFetch("https://test.local/");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.name, "TypeError");
  } finally { await mf.dispose(); }
});

test('actual public Worker imports accepted media into real D1/R2 runtime and refuses redirects',async()=>{
  const {outputFiles}=buildSync({stdin:{contents:`
    import {servePublicGalleryMedia} from './worker/public-gallery-media.ts';
    let sourceReads=0;
    globalThis.fetch=async(url,options)=>{
      const source=new Request(url,options);
      if(source.headers.has('cookie')||source.headers.has('authorization'))throw Error('credential_forwarding');
      if(source.url!=='https://www.vii.co.il/gallery/new.jpg'&&source.url!=='https://www.vii.co.il/gallery/redirect.jpg')throw Error('unexpected_source');
      sourceReads++;
      if(source.url.endsWith('/redirect.jpg'))return new Response(null,{status:302,headers:{Location:'https://foreign.invalid/image.jpg'}});
      return new Response(Uint8Array.from([255,216,255,...Array(61).fill(7)]),{headers:{'Content-Type':'image/jpeg','Content-Length':'64'}});
    };
    export default {async fetch(request,env){
      const result=await servePublicGalleryMedia(request,env.UPLOADS,undefined,env.DB);
      const headers=new Headers(result.headers);headers.set('X-Source-Reads',String(sourceReads));
      return new Response(result.body,{status:result.status,headers});
    }};
  `,resolveDir:process.cwd(),sourcefile:'media-runtime-harness.ts'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
  const mf=new Miniflare({modules:true,script:outputFiles[0].text,compatibilityDate:'2026-05-15',d1Databases:['DB'],r2Buckets:['UPLOADS']});
  try{
    const db=await mf.getD1Database('DB');
    await db.exec('CREATE TABLE supplier_catalog_state(world TEXT,active_run_id TEXT); CREATE TABLE supplier_catalog_entries(world TEXT,run_id TEXT,summary_json TEXT,detail_json TEXT);');
    await db.prepare('INSERT INTO supplier_catalog_state VALUES (?,?)').bind('rooms','current').run();
    await db.prepare('INSERT INTO supplier_catalog_entries VALUES (?,?,?,?)').bind('rooms','current',JSON.stringify({rooms:[{images:['/api/vii/media/new.jpg','/api/vii/media/redirect.jpg']}]}),null).run();
    const first=await mf.dispatchFetch('https://vii.spaplus.co/api/vii/media/new.jpg',{headers:{Cookie:'private=never-forward'}});
    assert.equal(first.status,200);assert.equal(first.headers.get('X-VII-Media'),'catalog-imported');assert.equal(first.headers.get('X-Source-Reads'),'1');
    const bytes=new Uint8Array(await first.arrayBuffer());assert.deepEqual(bytes,Uint8Array.from([255,216,255,...Array(61).fill(7)]));
    const bucket=await mf.getR2Bucket('UPLOADS');const stored=await bucket.get('legacy-gallery/v1/new.jpg');
    assert.ok(stored);assert.equal(stored.httpMetadata.contentType,'image/jpeg');assert.match(stored.customMetadata.sha256,/^[a-f0-9]{64}$/);assert.deepEqual(new Uint8Array(await stored.arrayBuffer()),bytes);
    const head=await mf.dispatchFetch('https://vii.spaplus.co/api/vii/media/new.jpg',{method:'HEAD'});
    assert.equal(head.status,200);assert.equal(head.headers.get('X-VII-Media'),'stored');assert.equal(head.headers.get('X-Source-Reads'),'1');assert.equal((await head.arrayBuffer()).byteLength,0);
    const redirect=await mf.dispatchFetch('https://vii.spaplus.co/api/vii/media/redirect.jpg');
    assert.equal(redirect.status,503);assert.equal(redirect.headers.get('Cache-Control'),'no-store');assert.equal(await bucket.get('legacy-gallery/v1/redirect.jpg'),null);
  }finally{await mf.dispose()}
});

test('all four catalog media monitors execute in Workers and reject a redirected catalog',async()=>{
  const {outputFiles}=buildSync({stdin:{contents:`
    import {executeCatalogMediaCheck} from './app/lib/quality-catalog-media.ts';
    export default {async fetch(input){
      const mode=new URL(input.url).searchParams;const world=mode.get('world');let calls=0;
      const result=await executeCatalogMediaCheck({catalogMediaWorld:world,route:'/api/catalog?world='+world,timeoutMs:5000},'https://vii.spaplus.co',async(url,options)=>{
        const request=new Request(url,options);calls++;
        if(mode.has('redirect'))return new Response(null,{status:302,headers:{Location:'https://foreign.invalid/catalog'}});
        if(request.method==='HEAD')return new Response(null,{headers:{'Content-Type':'image/jpeg','Content-Length':'64'}});
        const detail={images:['/api/vii/media/general.jpg'],rooms:[{images:['/api/vii/media/unit.jpg']}]};
        return new URL(request.url).searchParams.has('id')?Response.json({entry:{supplierId:1,summary:detail,detail}}):Response.json({entries:[{supplierId:1}]});
      });return Response.json({result,calls});
    }};
  `,resolveDir:process.cwd(),sourcefile:'catalog-monitor-runtime.ts'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
  const mf=new Miniflare({modules:true,script:outputFiles[0].text,compatibilityDate:'2026-05-15'});
  try{
    for(const world of ['vacations','events','rooms','spa']){
      const result=await(await mf.dispatchFetch('https://test.local/?world='+world)).json();
      assert.equal(result.result.status,'passed',JSON.stringify(result));assert.equal(result.calls,4);
    }
    const redirected=await(await mf.dispatchFetch('https://test.local/?world=rooms&redirect=1')).json();
    assert.equal(redirected.result.status,'failed');assert.equal(redirected.calls,1);assert.match(redirected.result.observed,/302/);
  }finally{await mf.dispose()}
});
