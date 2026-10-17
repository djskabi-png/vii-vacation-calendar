import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';
import {rewriteOriginStream} from '../worker/stream-origin.ts';
const from='https://vii.spaplus.co',to='https://www.vii.co.il';
const input=`<html><head><link rel="canonical" href="${from}/spas"/></head><body><h1>ספא בישראל 😎</h1><img src="${from}/media/photo.jpg"/><script>self.rsc={"url":"${from}/en/spas","text":"שלום"}</script>${from}${from}</body></html>`;

test('primary origin streaming matches former replaceAll at every UTF8 split',async()=>{
 const bytes=new TextEncoder().encode(input);
 for(let split=1;split<bytes.length;split++){
  const source=new ReadableStream({start(c){c.enqueue(bytes.slice(0,split));c.enqueue(bytes.slice(split));c.close();}});
  assert.equal(await rewriteOriginStream(new Response(source),from,to).text(),input.replaceAll(from,to),`split${split}`);
 }
});

test('one-byte chunks preserve adjacent origins, incomplete suffixes and nonmatches',async()=>{
 for(const text of [input,from+from,from.slice(0,-1),'unrelated שלום',from+'/#organization']){
  const source=new ReadableStream({start(c){for(const byte of new TextEncoder().encode(text))c.enqueue(Uint8Array.of(byte));c.close();}});
  assert.equal(await rewriteOriginStream(new Response(source),from,to).text(),text.replaceAll(from,to));
 }
});

test('primary hero and rewritten links arrive before an unresolved catalog tail',async()=>{
 let source;
 const first=`<html><head><link href="${from}/spas"/></head><body><h1>כל מה שעושים בחופש, במקום אחד</h1>${'.'.repeat(80)}`;
 const response=rewriteOriginStream(new Response(new ReadableStream({start(c){source=c;c.enqueue(new TextEncoder().encode(first));}}),{status:200,headers:{'Content-Type':'text/html','Content-Length':'999','X-Custom':'preserved'}}),from,to);
 const reader=response.body.getReader();let visible='';
 while(!visible.includes('</h1>')){const part=await reader.read();assert.equal(part.done,false);visible+=new TextDecoder().decode(part.value);}
 assert.match(visible,/כל מה שעושים בחופש, במקום אחד/);assert.match(visible,/https:\/\/www.vii.co.il\/spas/);
 assert.equal(response.headers.get('content-length'),null);assert.equal(response.headers.get('x-custom'),'preserved');
 source.enqueue(new TextEncoder().encode(`${from}/tail</body></html>`));source.close();
 while(true){const part=await reader.read();if(part.done)break;visible+=new TextDecoder().decode(part.value);}
 assert.equal(visible,(first+`${from}/tail</body></html>`).replaceAll(from,to));
});

test('upstream cancellation and errors propagate without manufacturing a successful tail',async()=>{
 let canceled=false;
 const source=new ReadableStream({pull(c){c.enqueue(new TextEncoder().encode('unchanged'.repeat(10)));},cancel(){canceled=true;}});
 const reader=rewriteOriginStream(new Response(source),from,to).body.getReader();await reader.read();await reader.cancel('visitor left');await new Promise(setImmediate);assert.equal(canceled,true);
 const broken=new ReadableStream({start(c){c.error(new Error('upstream_failed'));}});
 await assert.rejects(()=>rewriteOriginStream(new Response(broken),from,to).text(),/upstream_failed/);
});

test('status, null body and staging transform invariants remain unchanged',async()=>{
 const empty=rewriteOriginStream(new Response(null,{status:204,headers:{'X-Robots-Tag':'noindex'}}),from,to);
 assert.equal(empty.status,204);assert.equal(empty.body,null);assert.equal(empty.headers.get('x-robots-tag'),'noindex');
 assert.throws(()=>rewriteOriginStream(new Response('text'),'','target'),/source_required/);
 const source=await readFile(new URL('../worker/index.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/await transformed\.text\(\)/);
 assert.match(source,/rewriteOriginStream\(transformed, temporaryOrigin, primaryOrigin\)/);
 assert.match(source,/primary \? rewriteOriginStream\(canonical, temporaryOrigin, primaryOrigin\) : canonical/);
});

test('real workerd HTMLRewriter and primary origin transform preserve terminal HTML/RSC bytes',{timeout:15000},async()=>{
 const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
 const {Miniflare}=await import(pathToFileURL(wranglerRequire.resolve('miniflare')).href);
 const helper=stripTypeScriptTypes(await readFile(new URL('../worker/stream-origin.ts',import.meta.url),'utf8'),{mode:'strip'});
 const prefix=`<html><head><link rel="canonical" href="${from}/"/></head><body><h1>ספא בישראל 😎</h1><p>${'.'.repeat(8192)}</p>`;
 const tail=`<script>self.rsc={"url":"${from}/en/spas"}</script></body></html>`;
 const mf=new Miniflare({modules:true,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],script:`${helper}
 export default {fetch(){
  const response=new Response(${JSON.stringify(prefix+tail)},{headers:{'Content-Type':'text/html'}});
  const rewritten=new HTMLRewriter().on('link[rel="canonical"]',{element(el){el.setAttribute('href',${JSON.stringify(to+'/')});}}).transform(response);
  return rewriteOriginStream(rewritten,${JSON.stringify(from)},${JSON.stringify(to)});
 }};`});
 try{
  const response=await mf.dispatchFetch('http://primary.test/');const text=await response.text();
  assert.equal(response.status,200);
  assert.match(text,/ספא בישראל 😎/);assert.ok(text.includes(to+'/'));
  assert.equal(text.includes(from),false);assert.ok(text.includes(to+'/en/spas'));
 }finally{await mf.dispose();}
});
