import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { publicCachePolicy } from '../worker/public-response-cache.ts';
import { servePublicGalleryMedia } from '../worker/public-gallery-media.ts';
import galleryManifest from '../app/data/legacy-gallery-media.json' with {type:'json'};
import { withServerRequestReads } from '../app/lib/server-request-reads.ts';

const source=await readFile(new URL('../worker/index.ts',import.meta.url),'utf8');
const transform=context=>root=>{
  const visit=node=>{
    if(ts.isImportDeclaration(node)||ts.isExportAssignment(node))return undefined;
    if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments[0]?.text==='vinext/server/app-router-entry') return ts.factory.createCallExpression(ts.factory.createIdentifier('loadApp'),undefined,[]);
    if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments[0]?.text==='./public-gallery-media.ts') return ts.factory.createCallExpression(ts.factory.createIdentifier('loadGallery'),undefined,[]);
    return ts.visitEachChild(node,visit,context);
  };
  return ts.visitNode(root,visit);
};
const executable=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},transformers:{before:[transform]}}).outputText.replace(/^export \{\};?\s*$/gm,'');
function instance({loadApp,read=async()=>null,onCacheRead=()=>{}}){
  const dependencies={loadApp,loadGallery:async()=>({servePublicGalleryMedia}),cloudflareDatabaseForEnv:()=>undefined,deploymentMediaAliases:{},shouldCheckRedirect:()=>false,
    legacyDisposition:()=>null,looksLikeUninventoriedLegacyPath:()=>false,publicCachePolicy,
    readPublicCache:async(...args)=>{onCacheRead();return read(...args);},refreshPublicCacheAhead:()=> 'fresh',
    storePublicCache:response=>response,editorialWorldLinks:[],withServerRequestReads};
  return new Function(...Object.keys(dependencies),executable+'\nreturn worker;')(...Object.values(dependencies));
}
const ctx={waitUntil(){}};
const request=path=>new Request(`https://vii.spaplus.co${path}`,{headers:{Accept:'text/html'}});

test('actual worker cache HIT never initializes application or scheduler modules',async()=>{
  let imports=0;
  const worker=instance({loadApp:()=>{imports++;assert.fail('HIT initialized app');},read:async()=>new Response('accepted cached document',{headers:{'Content-Type':'text/html'}})});
  const response=await worker.fetch(request('/search'),{},ctx);
  assert.equal(await response.text(),'accepted cached document');
  assert.equal(imports,0);
  assert.match(response.headers.get('Server-Timing'),/^vii-cache;dur=\d+$/);
});

test('actual worker concurrent MISS shares one module load and preserves locale and Flight request context',async()=>{
  let imports=0; const seen=[];
  const worker=instance({loadApp:async()=>{imports++;return {default:{fetch:async req=>{
    seen.push({pathname:new URL(req.url).pathname,locale:req.headers.get('x-vii-locale'),document:req.headers.get('x-vii-pathname')});
    return new Response('{}',{headers:{'Content-Type':'application/json'}});
  }}};}});
  await Promise.all([worker.fetch(request('/search'),{},ctx),worker.fetch(request('/en/search.rsc'),{},ctx)]);
  assert.equal(imports,1);
  assert.deepEqual(Object.fromEntries(seen.map(({pathname,...context})=>[pathname,context])),{'/search':{locale:'he',document:'/search'},'/en/search.rsc':{locale:'en',document:'/en/search'}});
});

test('actual worker failed module load is not retried internally or cached forever',async()=>{
  let imports=0;
  const worker=instance({loadApp:async()=>{imports++;if(imports===1)throw new Error('transient module load');return {default:{fetch:async()=>new Response('{}',{headers:{'Content-Type':'application/json'}})}};}});
  await assert.rejects(worker.fetch(request('/search'),{},ctx),/transient module load/);
  assert.equal(imports,1);
  const response=await worker.fetch(request('/search'),{},ctx);
  assert.equal(response.status,200);assert.equal(imports,2);
});

test('actual private-cookie request bypasses all public cache lookup before rendering',async()=>{
  let reads=0,imports=0;
  const worker=instance({onCacheRead:()=>reads++,loadApp:async()=>{imports++;return {default:{fetch:async()=>new Response('{}',{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}})}};}});
  const req=new Request('https://vii.spaplus.co/search',{headers:{Accept:'text/html',Cookie:'vii_admin_session=private'}});
  const response=await worker.fetch(req,{},ctx);
  assert.equal(reads,0);assert.equal(imports,1);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
});
test('public media streams exact allowlisted R2 bytes without application startup and preserves HEAD and failures',async()=>{
  const filename=galleryManifest.files[0],requested=[];
  const worker=instance({loadApp:()=>assert.fail('photo initialized whole app')});
  const uploads={get:async key=>{requested.push(key);return {body:new Blob(['same-image-bytes']).stream(),httpMetadata:{contentType:'image/jpeg'},httpEtag:'"same-etag"'};}};
  const url=`https://vii.spaplus.co/api/vii/media/${encodeURIComponent(filename)}`;
  const get=await worker.fetch(new Request(url),{UPLOADS:uploads},ctx);
  assert.equal(await get.text(),'same-image-bytes');assert.equal(get.headers.get('ETag'),'"same-etag"');
  assert.deepEqual(requested,[galleryManifest.objectPrefix+filename]);
  const head=await worker.fetch(new Request(url,{method:'HEAD'}),{UPLOADS:uploads},ctx);
  assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
  const absent=await worker.fetch(new Request('https://vii.spaplus.co/api/vii/media/not-in-public-manifest.jpg'),{UPLOADS:uploads},ctx);
  assert.equal(absent.status,404);assert.equal(requested.length,2);
  const apex=await worker.fetch(new Request(url.replace('vii.spaplus.co','vii.co.il')),{UPLOADS:uploads},ctx);
  assert.equal(apex.status,301);assert.ok(apex.headers.get('Location').startsWith('https://www.vii.co.il/api/vii/media/'));assert.equal(requested.length,2);
  assert.equal((await worker.fetch(new Request(url),{UPLOADS:{get:async()=>null}},ctx)).status,404);
  assert.equal((await worker.fetch(new Request(url),{UPLOADS:{get:async()=>{throw Error('storage');}}},ctx)).status,503);
});
