import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageHandler} from '../src/service.ts';
const path='/api/vii/media/abcdef1234567890.jpeg';
const href=(extra='')=>'https://images.example/?'+new URLSearchParams({url:path,w:'640',q:'85'})+extra;
function fixture(options={}) {
  const sources=[],native=[],writes=[];
  const sourceFetch=async(url,init)=>{sources.push({url,init});return new Response('source',{headers:{'Content-Type':'image/jpeg','Set-Cookie':'must-not-copy'}});};
  const IMAGES={input(stream){return {transform(transform){return {async output(output){native.push({transform,output});return {response:()=>new Response('transformed',{headers:{'Content-Type':output.format}})};}};}};}};
  return {sources,native,writes,IMAGES,ctx:{waitUntil:p=>writes.push(p)},handler:createImageHandler({sourceFetch,sourceMs:200,transformMs:200,...options})};
}
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
  assert.equal(f.sources[0].init.redirect,'error');
});
test('cache key canonicalizes actual format, survives HEAD, and writes through waitUntil',async()=>{
  const store=new Map(),keys=[];
  const edge={match:async key=>store.get(key.url)?.clone(),put:async(key,response)=>{keys.push(key.url);store.set(key.url,response);}};
  const f=fixture({edge:()=>edge});
  const response=await f.handler.fetch(new Request(href(),{headers:{Accept:'image/avif,image/webp'}}),{IMAGES:f.IMAGES},f.ctx);
  assert.equal(response.headers.get('Content-Type'),'image/avif');
  await Promise.all(f.writes);
  assert.match(keys[0],/format=avif/);
  const head=await f.handler.fetch(new Request(href(),{method:'HEAD',headers:{Accept:'image/avif'}}),{IMAGES:f.IMAGES},f.ctx);
  assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(f.sources.length,1);
  assert.equal(head.headers.get('X-VII-Image-Engine'),'cloudflare-images');
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
