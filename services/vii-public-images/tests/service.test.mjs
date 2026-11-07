import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageHandler} from '../src/service.ts';
import manifest from '../../../app/data/legacy-gallery-media.json' with {type:'json'};
const path='/api/vii/media/abcdef1234567890.jpeg';
const href=(extra='')=>'https://images.example/?'+new URLSearchParams({url:path,w:'640',q:'85'})+extra;
const legacy='https://www.vii.co.il/gallery/abcdef1234567890.jpeg';
function fixture(options={}) {
  const sources=[],native=[],writes=[];
  const sourceFetch=async(url,init)=>{sources.push({url,init});return new Response('source',{headers:{'Content-Type':'image/jpeg','Set-Cookie':'must-not-copy'}});};
  const IMAGES={input(stream){return {transform(transform){return {async output(output){native.push({transform,output});return {response:()=>new Response('transformed',{headers:{'Content-Type':output.format}})};}};}};}};
  return {sources,native,writes,IMAGES,ctx:{waitUntil:p=>writes.push(p)},handler:createImageHandler({sourceFetch,sourceMs:200,transformMs:200,firstResponseMs:0,storedSource:()=>true,...options})};
}

test('available capacity returns the native transform on the first response and writes the cache',async()=>{
 const store=new Map(),edge={match:async key=>store.get(key.url)?.clone(),put:async(key,value)=>{store.set(key.url,value);}};
 const f=fixture({edge:()=>edge,firstResponseMs:350});const response=await f.handler.fetch(new Request(href()),{IMAGES:f.IMAGES},f.ctx);
 assert.equal(response.status,200);assert.equal(response.headers.get('X-VII-Image-Engine'),'cloudflare-images');await Promise.all(f.writes);assert.equal(store.size,1);
});

test('slow first transform keeps bounded original fallback and completes the cache asynchronously',async()=>{
 let release;const store=new Map(),edge={match:async key=>store.get(key.url)?.clone(),put:async(key,value)=>{store.set(key.url,value);}};
 const f=fixture({edge:()=>edge,firstResponseMs:10,sourceFetch:()=>new Promise(resolve=>{release=()=>resolve(new Response('source',{headers:{'Content-Type':'image/jpeg'}}));})});
 const response=await f.handler.fetch(new Request(href()),{IMAGES:f.IMAGES},f.ctx);assert.equal(response.status,302);release();await Promise.all(f.writes);assert.equal(store.size,1);
});

test('new unlisted supplier photos have a working same-file cold fallback and warm native output',async()=>{
 const store=new Map(),edge={match:async key=>store.get(key.url)?.clone(),put:async(key,value)=>{store.set(key.url,value);}};
 const f=fixture({edge:()=>edge,storedSource:()=>false});
 const cold=await f.handler.fetch(new Request(href(),{headers:{Cookie:'private',Authorization:'private'}}),{IMAGES:f.IMAGES},f.ctx);
 assert.equal(cold.status,302);assert.equal(cold.headers.get('Location'),legacy);assert.equal(cold.headers.get('Cache-Control'),'no-store');
 await Promise.all(f.writes);assert.equal(f.sources.length,1);assert.equal(f.sources[0].url,legacy);assert.deepEqual(f.sources[0].init.headers,{Accept:'image/*'});assert.equal(f.sources[0].init.redirect,'manual');
 const warm=await f.handler.fetch(new Request(href()),{IMAGES:f.IMAGES},f.ctx);assert.equal(warm.status,200);assert.equal(warm.headers.get('X-VII-Image-Engine'),'cloudflare-images');assert.equal(f.sources.length,1);
});

test('production manifest selects stored originals and newly uploaded hashes without a test override',async()=>{
 const f=fixture({storedSource:undefined});await f.handler.fetch(new Request(href()),{IMAGES:f.IMAGES});assert.equal(f.sources[0].url,legacy);
 const filename=manifest.files.find(file=>/^[a-f0-9]{8,128}\.(?:jpe?g|png|webp|avif)$/i.test(file));assert.ok(filename);
 const g=fixture({storedSource:undefined});await g.handler.fetch(new Request(href().replace('abcdef1234567890.jpeg',filename)),{IMAGES:g.IMAGES});assert.equal(g.sources[0].url,'https://vii.spaplus.co/api/vii/media/'+filename);
});

test('a stored file falls back to its exact trusted public source only after source404',async()=>{
 const calls=[];const f=fixture({sourceFetch:async(url,init)=>{calls.push({url,init});return url===legacy?new Response('original',{headers:{'Content-Type':'image/jpeg'}}):new Response('missing',{status:404});}});
 const result=await f.handler.fetch(new Request(href()),{IMAGES:f.IMAGES});assert.equal(result.status,200);assert.deepEqual(calls.map(x=>x.url),['https://vii.spaplus.co'+path,legacy]);
 for(const status of [403,500,503]){let count=0;const g=fixture({sourceFetch:async()=>{count++;return new Response('error',{status});}});await g.handler.fetch(new Request(href()),{IMAGES:g.IMAGES});assert.equal(count,1);}
});

test('unlisted source redirect, invalid MIME and oversized image never enter native cache',async()=>{
 for(const response of [()=>new Response(null,{status:302,headers:{Location:'https://evil.test/private'}}),()=>new Response('HTML',{headers:{'Content-Type':'text/html'}}),()=>new Response('huge',{headers:{'Content-Type':'image/jpeg','Content-Length':String(12*1024*1024+1)}})]){
  const store=new Map(),f=fixture({storedSource:()=>false,sourceFetch:async()=>response(),edge:()=>({match:async()=>undefined,put:async(k,v)=>{store.set(k.url,v);}})});
  const cold=await f.handler.fetch(new Request(href()),{IMAGES:f.IMAGES},f.ctx);assert.equal(cold.headers.get('Location'),legacy);await Promise.all(f.writes);assert.equal(store.size,0);assert.equal(f.native.length,0);
 }
});
test('source, method, width, quality and format are finite, private URLs never reach fetch',async()=>{
  const f=fixture();
  for(const url of ['https://evil.test/a.jpeg','/admin','/api/vii/media/../../secret','/api/vii/media/abcdef1234567890.jpeg?token=secret','//evil.test/image']) {
    assert.equal((await f.handler.fetch(new Request('https://images.example/?'+new URLSearchParams({url,w:'640'})),{IMAGES:f.IMAGES})).status,400);
  }
  for(const extra of ['&w=641','&q=82.1','&q=NaN','&format=svg'])assert.equal((await f.handler.fetch(new Request(href(extra)),{IMAGES:f.IMAGES})).status,400);
  assert.equal((await f.handler.fetch(new Request(href(),{method:'POST'}),{IMAGES:f.IMAGES})).status,405);
  assert.equal(f.sources.length,0);
});
test('native options preserve source identity and prohibit upscaling; output uses official MIME',async()=>{
  const f=fixture();
  const response=await f.handler.fetch(new Request(href('&format=webp'),{headers:{Cookie:'private',Authorization:'private'}}),{IMAGES:f.IMAGES});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('X-VII-Image-Engine'),'cloudflare-images');
  assert.equal(response.headers.get('Content-Type'),'image/webp');
  assert.equal(response.headers.get('Set-Cookie'),null);
  assert.deepEqual(f.native,[{transform:{width:640,fit:'scale-down'},output:{format:'image/webp',quality:85}}]);
  assert.equal(f.sources[0].url,'https://vii.spaplus.co'+path);
  assert.deepEqual(f.sources[0].init.headers,{Accept:'image/*'});
  assert.equal(f.sources[0].init.redirect,'manual');
});
test('cache key canonicalizes actual format, survives HEAD, and writes through waitUntil',async()=>{
  const store=new Map(),keys=[];
  const edge={match:async key=>store.get(key.url)?.clone(),put:async(key,response)=>{keys.push(key.url);store.set(key.url,response);}};
  const f=fixture({edge:()=>edge});
  const response=await f.handler.fetch(new Request(href(),{headers:{Accept:'image/avif,image/webp'}}),{IMAGES:f.IMAGES},f.ctx);
  assert.equal(response.status,302);assert.equal(response.headers.get('X-VII-Image-Fallback'),'warming');
  await Promise.all(f.writes);
  assert.match(keys[0],/format=avif/);
  const head=await f.handler.fetch(new Request(href(),{method:'HEAD',headers:{Accept:'image/avif'}}),{IMAGES:f.IMAGES},f.ctx);
  assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(f.sources.length,1);
  assert.equal(head.headers.get('X-VII-Image-Engine'),'cloudflare-images');
  assert.equal(head.headers.get('Content-Type'),'image/avif');
});
test('network, invalid MIME and native failures fall back to the same public source, never another picture',async()=>{
  for(const options of [{sourceFetch:async()=>{throw Error('network');}},{sourceFetch:async()=>new Response('html',{headers:{'Content-Type':'text/html'}})}]){
    const f=fixture(options),response=await f.handler.fetch(new Request(href()),{IMAGES:f.IMAGES});
    assert.equal(response.status,302);assert.equal(response.headers.get('Location'),'https://vii.spaplus.co'+path);
    assert.equal(response.headers.get('X-VII-Image-Engine'),'source-fallback');
  }
  const f=fixture();
  assert.equal((await f.handler.fetch(new Request(href()),{})).headers.get('Location'),'https://vii.spaplus.co'+path);
  const broken={input(){throw Error('binding');}};
  assert.equal((await f.handler.fetch(new Request(href()),{IMAGES:broken})).status,302);
});
test('source and native timeouts are bounded and consume late failure without retry',async()=>{
  const f=fixture({sourceFetch:()=>new Promise(()=>{}),sourceMs:10});
  assert.equal((await f.handler.fetch(new Request(href()),{IMAGES:f.IMAGES})).status,302);
  const g=fixture({transformMs:10});
  const hanging={input(){return {transform(){return {output:()=>new Promise(()=>{})};}};}};
  assert.equal((await g.handler.fetch(new Request(href()),{IMAGES:hanging})).status,302);assert.equal(g.sources.length,1);
});
test('chunked source larger than12MiB is stopped without decoding inside the worker',async()=>{
  const f=fixture({sourceFetch:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(12*1024*1024+1));c.close();}}),{headers:{'Content-Type':'image/jpeg'}})});
  const consuming={input(stream){return {transform(){return {async output(){await new Response(stream).arrayBuffer();return {response:()=>new Response('bad')};}};}};}};
  assert.equal((await f.handler.fetch(new Request(href()),{IMAGES:consuming})).status,302);
});
test('concurrent uncached transformations are capped and duplicate work falls back without another fetch',async()=>{
  const releases=[];
  const f=fixture({sourceFetch:()=>new Promise(resolve=>releases.push(()=>resolve(new Response('source',{headers:{'Content-Type':'image/jpeg'}}))))});
  const urls=Array.from({length:5},(_,i)=>href().replace('abcdef1234567890',`abcdef123456789${i}`));
  const pending=urls.slice(0,4).map(url=>f.handler.fetch(new Request(url),{IMAGES:f.IMAGES}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(releases.length,4);
  assert.equal((await f.handler.fetch(new Request(urls[4]),{IMAGES:f.IMAGES})).status,302);
  assert.equal((await f.handler.fetch(new Request(urls[0]),{IMAGES:f.IMAGES})).status,302);
  assert.equal(releases.length,4);
  releases.forEach(release=>release());
  assert.ok((await Promise.all(pending)).every(response=>response.status===200));
});
test('per-isolate admission window is bounded, resets and never applies to stored image hits',async()=>{
  let clock=100;
  const f=fixture({now:()=>clock,maxAdmissions:1});
  assert.equal((await f.handler.fetch(new Request(href()),{IMAGES:f.IMAGES})).status,200);
  const other=href().replace('abcdef1234567890','abcdef1234567891');
  assert.equal((await f.handler.fetch(new Request(other),{IMAGES:f.IMAGES})).status,302);
  clock+=60001;
  assert.equal((await f.handler.fetch(new Request(other),{IMAGES:f.IMAGES})).status,200);
});
test('cold client gets the original before slow source work completes, then stored native output serves the next request',async()=>{
  let release;const store=new Map();
  const edge={match:async key=>store.get(key.url)?.clone(),put:async(key,value)=>{store.set(key.url,value);}};
  const f=fixture({edge:()=>edge,sourceFetch:()=>new Promise(resolve=>{release=()=>resolve(new Response('source',{headers:{'Content-Type':'image/jpeg'}}));})});
  const response=await f.handler.fetch(new Request(href()),{IMAGES:f.IMAGES},f.ctx);
  assert.equal(response.status,302);assert.equal(f.writes.length,1);assert.equal(f.native.length,0);
  assert.equal(response.headers.get('Location'),'https://vii.spaplus.co'+path);
  release();await Promise.all(f.writes);
  const warm=await f.handler.fetch(new Request(href()),{IMAGES:f.IMAGES},f.ctx);
  assert.equal(warm.status,200);assert.equal(await warm.text(),'transformed');assert.equal(f.native.length,1);
});
